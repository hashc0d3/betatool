import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('export/stock')
  async exportStock() {
    const buf = await this.reportsService.exportStockXlsx();
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ostatki.xlsx"',
    });
  }

  @Get('export/day')
  async exportDay(@Query('date') date: string) {
    const buf = await this.reportsService.exportDayXlsx(date);
    const safe = date.replace(/[^\d-]/g, '') || 'day';
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="prodazhi-den-${safe}.xlsx"`,
    });
  }

  @Get('export/range')
  async exportRange(@Query('from') from: string, @Query('to') to: string) {
    const buf = await this.reportsService.exportRangeXlsx(from, to);
    const a = from.replace(/[^\d-]/g, '') || 'from';
    const b = to.replace(/[^\d-]/g, '') || 'to';
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="prodazhi-${a}_${b}.xlsx"`,
    });
  }

  /** Остатки по товарам (без картинок) */
  @Get('stock')
  stock() {
    return this.reportsService.stockOverview();
  }

  /** Продажи за один календарный день */
  @Get('day')
  day(@Query('date') date: string) {
    return this.reportsService.reportDay(date);
  }

  /** Продажи за период, сгруппировано по дням */
  @Get('range')
  range(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.reportRange(from, to);
  }
}
