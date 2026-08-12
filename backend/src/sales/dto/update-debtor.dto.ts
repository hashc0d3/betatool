import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
} from '../../common/payment-method';

export class UpdateDebtorDto {
  @IsString()
  @MinLength(1)
  debtorName: string;
}

export class RenameDebtorDto {
  @IsString()
  @MinLength(1)
  from: string;

  @IsString()
  @MinLength(1)
  to: string;
}

export class DebtorNameDto {
  @IsString()
  @MinLength(1)
  debtorName: string;
}

export class PayDebtorDto {
  @IsString()
  @MinLength(1)
  debtorName: string;

  /** Дефолт — безналичный */
  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: (typeof PAYMENT_METHODS)[number] = DEFAULT_PAYMENT_METHOD;
}

export class PaySaleDto {
  /** Дефолт — безналичный */
  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: (typeof PAYMENT_METHODS)[number] = DEFAULT_PAYMENT_METHOD;
}
