import { IsString, MinLength } from 'class-validator';

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
