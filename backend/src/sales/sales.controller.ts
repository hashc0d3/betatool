import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateDeferredSaleDto } from './dto/create-deferred-sale.dto';
import {
  DebtorNameDto,
  RenameDebtorDto,
  UpdateDebtorDto,
} from './dto/update-debtor.dto';

type AuthenticatedRequest = Request & {
  user?: {
    login?: string;
  };
};

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  @Post('deferred')
  createDeferred(@Body() dto: CreateDeferredSaleDto) {
    return this.salesService.createDeferred(dto);
  }

  @Get('deferred')
  findDeferred(@Query('q') q?: string) {
    return this.salesService.findDeferred(q);
  }

  @Patch('deferred/rename')
  renameDebtor(@Body() dto: RenameDebtorDto) {
    return this.salesService.renameDebtor(dto.from, dto.to);
  }

  @Post('deferred/pay')
  payByDebtor(@Body() dto: DebtorNameDto) {
    return this.salesService.markPaidByDebtor(dto.debtorName);
  }

  @Post('deferred/remove')
  removeByDebtor(
    @Body() dto: DebtorNameDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.salesService.removeByDebtor(
      dto.debtorName,
      req.user?.login ?? 'unknown',
    );
  }

  @Roles('deleted-sales-admin')
  @Get('deleted')
  deleted() {
    return this.salesService.findDeleted();
  }

  @Patch(':id/debtor')
  updateDebtor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDebtorDto,
  ) {
    return this.salesService.updateDebtorName(id, dto.debtorName);
  }

  @Post(':id/pay')
  markPaid(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.markPaid(id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.salesService.remove(id, req.user?.login ?? 'unknown');
  }
}
