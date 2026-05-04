import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
  ) {}

  async onModuleInit() {
    await this.ensureDefault();
  }

  async findAll() {
    await this.ensureDefault();
    return this.categoriesRepo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateCategoryDto) {
    const name = this.normalizeName(dto.name);
    const exists = await this.categoriesRepo.findOne({ where: { name } });
    if (exists) throw new ConflictException('Такая категория уже есть');

    const saved = await this.categoriesRepo.save(
      this.categoriesRepo.create({ name }),
    );
    return saved;
  }

  private async ensureDefault() {
    const exists = await this.categoriesRepo.findOne({
      where: { name: 'default' },
    });
    if (!exists) {
      await this.categoriesRepo.save(
        this.categoriesRepo.create({ name: 'default' }),
      );
    }
  }

  private normalizeName(name: string): string {
    return name.trim() || 'default';
  }
}
