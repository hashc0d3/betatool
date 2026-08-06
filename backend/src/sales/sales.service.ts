import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  CreateDeferredSaleDto,
  DeferredSaleItemDto,
} from './dto/create-deferred-sale.dto';

function lineAmount(s: Sale): number {
  return Math.round(s.unitPrice * s.quantity * 100) / 100;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSaleDto) {
    return this.dataSource.transaction(async (manager) => {
      return this.createSaleLine(manager, dto, {
        isDeferred: false,
        debtorName: null,
        paidAt: null,
      });
    });
  }

  async createDeferred(dto: CreateDeferredSaleDto) {
    const debtorName = dto.debtorName.trim();
    if (!debtorName) {
      throw new BadRequestException('Укажите имя кто взял товар');
    }

    return this.dataSource.transaction(async (manager) => {
      const saved: Sale[] = [];
      for (const item of dto.items) {
        const sale = await this.createSaleLine(manager, item, {
          isDeferred: true,
          debtorName,
          paidAt: null,
        });
        saved.push(sale);
      }
      return saved;
    });
  }

  private async createSaleLine(
    manager: EntityManager,
    dto: CreateSaleDto | DeferredSaleItemDto,
    opts: {
      isDeferred: boolean;
      debtorName: string | null;
      paidAt: Date | null;
    },
  ) {
    const productRepo = manager.getRepository(Product);
    const saleRepo = manager.getRepository(Sale);

    const product = await productRepo.findOne({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Недостаточно товара на складе: ${product.name}`,
      );
    }
    const isPersonal = product.isPersonal || dto.isPersonal === true;
    let recipientName = dto.recipientName?.trim() || null;
    if (isPersonal && !recipientName) {
      recipientName = opts.debtorName;
    }
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
      isDeferred: opts.isDeferred,
      debtorName: opts.debtorName,
      paidAt: opts.paidAt,
    });
    return saleRepo.save(sale);
  }

  async findDeferred(search?: string) {
    const qb = this.salesRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.isDeferred = :def', { def: true })
      .andWhere('s.paidAt IS NULL')
      .orderBy('s.debtorName', 'ASC')
      .addOrderBy('s.createdAt', 'ASC');

    const q = search?.trim();
    if (q) {
      qb.andWhere('LOWER(s.debtorName) LIKE :q', {
        q: `%${q.toLowerCase()}%`,
      });
    }

    const sales = await qb.getMany();
    return sales.map((s) => ({
      ...s,
      amount: lineAmount(s),
    }));
  }

  async renameDebtor(fromRaw: string, toRaw: string) {
    const from = fromRaw.trim();
    const to = toRaw.trim();
    if (!from || !to) {
      throw new BadRequestException('Укажите имя');
    }
    if (from === to) {
      return { updated: 0 };
    }

    const result = await this.salesRepo
      .createQueryBuilder()
      .update(Sale)
      .set({ debtorName: to })
      .where('deletedAt IS NULL')
      .andWhere('isDeferred = :def', { def: true })
      .andWhere('paidAt IS NULL')
      .andWhere('debtorName = :from', { from })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async updateDebtorName(id: number, debtorNameRaw: string) {
    const debtorName = debtorNameRaw.trim();
    if (!debtorName) {
      throw new BadRequestException('Укажите имя');
    }

    const sale = await this.requireOpenDeferred(id);
    sale.debtorName = debtorName;
    return this.salesRepo.save(sale);
  }

  async markPaid(id: number) {
    const sale = await this.requireOpenDeferred(id);
    sale.paidAt = new Date();
    return this.salesRepo.save(sale);
  }

  async markPaidByDebtor(debtorNameRaw: string) {
    const debtorName = debtorNameRaw.trim();
    if (!debtorName) {
      throw new BadRequestException('Укажите имя');
    }

    const open = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.isDeferred = :def', { def: true })
      .andWhere('s.paidAt IS NULL')
      .andWhere('s.debtorName = :debtorName', { debtorName })
      .getMany();

    if (open.length === 0) {
      throw new NotFoundException('Отложенные платежи не найдены');
    }

    const paidAt = new Date();
    for (const s of open) {
      s.paidAt = paidAt;
    }
    await this.salesRepo.save(open);
    return { paid: open.length, paidAt };
  }

  async removeByDebtor(debtorNameRaw: string, deletedBy: string) {
    const debtorName = debtorNameRaw.trim();
    if (!debtorName) {
      throw new BadRequestException('Укажите имя');
    }

    const open = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.isDeferred = :def', { def: true })
      .andWhere('s.paidAt IS NULL')
      .andWhere('s.debtorName = :debtorName', { debtorName })
      .getMany();

    if (open.length === 0) {
      throw new NotFoundException('Отложенные платежи не найдены');
    }

    for (const s of open) {
      await this.remove(s.id, deletedBy);
    }
    return { removed: open.length };
  }

  async findInRange(from: Date, to: Date) {
    return this.salesRepo
      .createQueryBuilder('s')
      .where('s.createdAt >= :from AND s.createdAt <= :to', { from, to })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('(s.isDeferred = :defFalse OR s.paidAt IS NOT NULL)', {
        defFalse: false,
      })
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
      amount: lineAmount(s),
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

  private async requireOpenDeferred(id: number): Promise<Sale> {
    const sale = await this.salesRepo.findOne({ where: { id } });
    if (!sale || sale.deletedAt) {
      throw new NotFoundException('Отложенный платёж не найден');
    }
    if (!sale.isDeferred || sale.paidAt) {
      throw new BadRequestException('Это не открытый отложенный платёж');
    }
    return sale;
  }
}
