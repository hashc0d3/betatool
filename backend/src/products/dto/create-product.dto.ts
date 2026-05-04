import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isPersonal: boolean = false;
}
