import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSaleDto) {
    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const saleRepo = manager.getRepository(Sale);

      const product = await productRepo.findOne({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Товар не найден');
      if (product.stock < dto.quantity) {
        throw new BadRequestException('Недостаточно товара на складе');
      }

      product.stock -= dto.quantity;
      await productRepo.save(product);

      const sale = saleRepo.create({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: dto.quantity,
      });
      return saleRepo.save(sale);
    });
  }

  async findInRange(from: Date, to: Date) {
    return this.salesRepo
      .createQueryBuilder('s')
      .where('s.createdAt >= :from AND s.createdAt <= :to', { from, to })
      .orderBy('s.createdAt', 'ASC')
      .getMany();
  }
}
