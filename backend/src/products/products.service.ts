import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Product } from '../entities/product.entity';
import { StockChange } from '../entities/stock-change.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(StockChange)
    private readonly stockChangesRepo: Repository<StockChange>,
  ) {}

  private toPublicUrl(storedPath: string | null): string | null {
    if (!storedPath) return null;
    if (storedPath.startsWith('/')) return storedPath;
    return `/${storedPath}`;
  }

  private mapProduct(p: Product) {
    return {
      ...p,
      category: p.category || 'default',
      imageUrl: this.toPublicUrl(p.imageUrl),
    };
  }

  private normalizeCategory(category: string | null | undefined): string {
    return category?.trim() || 'default';
  }

  private async recordStockChange(
    product: Product,
    oldStock: number,
    newStock: number,
    changedBy: string,
  ) {
    if (oldStock === newStock) return;
    await this.stockChangesRepo.save(
      this.stockChangesRepo.create({
        productId: product.id,
        productName: product.name,
        oldStock,
        newStock,
        changedBy,
      }),
    );
  }

  async findAll() {
    const list = await this.productsRepo.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return list.map((p) => this.mapProduct(p));
  }

  async findOne(id: number) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Товар не найден');
    return this.mapProduct(p);
  }

  async reorder(ids: number[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('В списке порядка есть дубликаты');
    }

    const products = await this.productsRepo.find();
    if (products.length !== unique.length) {
      throw new BadRequestException('Список порядка не совпадает с товарами');
    }
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const id of unique) {
      if (!byId.has(id)) {
        throw new NotFoundException(`Товар не найден: ${id}`);
      }
    }

    for (let i = 0; i < unique.length; i++) {
      const p = byId.get(unique[i])!;
      p.sortOrder = i;
    }
    await this.productsRepo.save([...byId.values()]);
    return this.findAll();
  }

  async create(
    dto: CreateProductDto,
    filename: string | null | undefined,
    changedBy: string,
  ) {
    const imageUrl = filename ? `/uploads/products/${filename}` : null;
    const maxRow = await this.productsRepo
      .createQueryBuilder('p')
      .select('MAX(p.sortOrder)', 'max')
      .getRawOne<{ max: number | string | null }>();
    const nextOrder = Number(maxRow?.max ?? -1) + 1;
    const entity = this.productsRepo.create({
      name: dto.name,
      price: dto.price,
      stock: dto.stock,
      category: this.normalizeCategory(dto.category),
      isPersonal: dto.isPersonal ?? false,
      imageUrl,
      sortOrder: nextOrder,
    });
    const saved = await this.productsRepo.save(entity);
    await this.recordStockChange(saved, 0, saved.stock, changedBy);
    return this.mapProduct(saved);
  }

  async update(
    id: number,
    dto: UpdateProductDto,
    newFilename: string | null | undefined,
    changedBy: string,
  ) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Товар не найден');

    const oldStock = p.stock;

    if (dto.name !== undefined) p.name = dto.name;
    if (dto.price !== undefined) p.price = dto.price;
    if (dto.stock !== undefined) p.stock = dto.stock;
    if (dto.category !== undefined)
      p.category = this.normalizeCategory(dto.category);
    if (dto.isPersonal !== undefined) p.isPersonal = dto.isPersonal;

    if (newFilename) {
      if (p.imageUrl?.startsWith('/uploads/products/')) {
        const oldFile = join(process.cwd(), p.imageUrl.replace(/^\//, ''));
        try {
          await unlink(oldFile);
        } catch {
          /* ignore */
        }
      }
      p.imageUrl = `/uploads/products/${newFilename}`;
    }

    const saved = await this.productsRepo.save(p);
    await this.recordStockChange(saved, oldStock, saved.stock, changedBy);
    return this.mapProduct(saved);
  }

  async remove(id: number) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Товар не найден');
    if (p.imageUrl?.startsWith('/uploads/products/')) {
      const filePath = join(process.cwd(), p.imageUrl.replace(/^\//, ''));
      try {
        await unlink(filePath);
      } catch {
        /* ignore */
      }
    }
    await this.productsRepo.remove(p);
    return { ok: true };
  }
}
