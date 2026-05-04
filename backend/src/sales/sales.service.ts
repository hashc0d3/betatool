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

      const product = await productRepo.findOne({
        where: { id: dto.productId },
      });
      if (!product) throw new NotFoundException('Товар не найден');
      if (product.stock < dto.quantity) {
        throw new BadRequestException('Недостаточно товара на складе');
      }
      const isPersonal = product.isPersonal || dto.isPersonal === true;
      const recipientName = dto.recipientName?.trim() || null;
      if (isPersonal && !recipientName) {
        throw new BadRequestException('Для персоналки укажите имя кто взял');
      }

      product.stock -= dto.quantity;
      await productRepo.save(product);

      const sale = saleRepo.create({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: dto.quantity,
        isPersonal,
        recipientName,
      });
      return saleRepo.save(sale);
    });
  }

  async findInRange(from: Date, to: Date) {
    return this.salesRepo
      .createQueryBuilder('s')
      .where('s.createdAt >= :from AND s.createdAt <= :to', { from, to })
      .andWhere('s.deletedAt IS NULL')
      .orderBy('s.createdAt', 'ASC')
      .getMany();
  }

  async findDeleted() {
    const sales = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NOT NULL')
      .orderBy('s.deletedAt', 'DESC')
      .getMany();
    return sales.map((s) => ({
      ...s,
      amount: Math.round(s.unitPrice * s.quantity * 100) / 100,
    }));
  }

  async remove(id: number, deletedBy: string) {
    return this.dataSource.transaction(async (manager) => {
      const saleRepo = manager.getRepository(Sale);
      const productRepo = manager.getRepository(Product);

      const sale = await saleRepo.findOne({ where: { id } });
      if (!sale) throw new NotFoundException('Продажа не найдена');
      if (sale.deletedAt) {
        throw new BadRequestException('Продажа уже удалена');
      }

      const product = await productRepo.findOne({
        where: { id: sale.productId },
      });
      if (product) {
        product.stock += sale.quantity;
        await productRepo.save(product);
      }

      sale.deletedAt = new Date();
      sale.deletedBy = deletedBy;
      return saleRepo.save(sale);
    });
  }
}
