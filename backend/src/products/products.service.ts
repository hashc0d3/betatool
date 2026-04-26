import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
  ) {}

  private toPublicUrl(storedPath: string | null): string | null {
    if (!storedPath) return null;
    if (storedPath.startsWith('/')) return storedPath;
    return `/${storedPath}`;
  }

  private mapProduct(p: Product) {
    return {
      ...p,
      imageUrl: this.toPublicUrl(p.imageUrl),
    };
  }

  async findAll() {
    const list = await this.productsRepo.find({ order: { id: 'ASC' } });
    return list.map((p) => this.mapProduct(p));
  }

  async findOne(id: number) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Товар не найден');
    return this.mapProduct(p);
  }

  async create(dto: CreateProductDto, filename?: string | null) {
    const imageUrl = filename ? `/uploads/products/${filename}` : null;
    const entity = this.productsRepo.create({
      name: dto.name,
      price: dto.price,
      stock: dto.stock,
      imageUrl,
    });
    const saved = await this.productsRepo.save(entity);
    return this.mapProduct(saved);
  }

  async update(
    id: number,
    dto: UpdateProductDto,
    newFilename?: string | null,
  ) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Товар не найден');

    if (dto.name !== undefined) p.name = dto.name;
    if (dto.price !== undefined) p.price = dto.price;
    if (dto.stock !== undefined) p.stock = dto.stock;

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
