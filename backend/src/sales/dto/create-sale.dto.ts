import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
} from '../../common/payment-method';

export class CreateSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  recipientName?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPersonal?: boolean;

  /** Дефолт — безналичный */
  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: (typeof PAYMENT_METHODS)[number] = DEFAULT_PAYMENT_METHOD;
}
