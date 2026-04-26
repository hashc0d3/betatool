import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';

function dayBoundsLocal(dateStr: string): { start: Date; end: Date } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new BadRequestException('Ожидается дата YYYY-MM-DD');
  }
  const [y, m, d] = parts;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

function formatDayLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function lineAmount(s: Sale): number {
  return Math.round(s.unitPrice * s.quantity * 100) / 100;
}

type ReportLine = {
  id: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  createdAt: Date;
  amount: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
  ) {}

  async stockOverview() {
    const items = await this.productsRepo.find({
      order: { name: 'ASC' },
      select: ['id', 'name', 'price', 'stock'],
    });
    const totalQuantity = items.reduce((a, p) => a + p.stock, 0);
    return { items, totalQuantity };
  }

  async reportDay(dateStr: string) {
    const { start, end } = dayBoundsLocal(dateStr);
    const sales = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.createdAt >= :start AND s.createdAt <= :end', { start, end })
      .orderBy('s.createdAt', 'ASC')
      .getMany();

    const lines = sales.map((s) => this.toLine(s));

    const totalQuantity = sales.reduce((a, s) => a + s.quantity, 0);
    const totalAmount =
      Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;

    return { date: dateStr, lines, totalQuantity, totalAmount };
  }

  async reportRange(fromStr: string, toStr: string) {
    const { start: rangeStart } = dayBoundsLocal(fromStr);
    const { end: rangeEnd } = dayBoundsLocal(toStr);
    if (rangeStart > rangeEnd) {
      throw new BadRequestException('Дата «с» позже даты «по»');
    }

    const sales = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.createdAt >= :from AND s.createdAt <= :to', {
        from: rangeStart,
        to: rangeEnd,
      })
      .orderBy('s.createdAt', 'ASC')
      .getMany();

    const dayMap = new Map<
      string,
      {
        date: string;
        lines: ReportLine[];
        totalQuantity: number;
        totalAmount: number;
      }
    >();

    for (const s of sales) {
      const day = formatDayLocal(new Date(s.createdAt));
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          date: day,
          lines: [],
          totalQuantity: 0,
          totalAmount: 0,
        });
      }
      const bucket = dayMap.get(day)!;
      const line = this.toLine(s);
      bucket.lines.push(line);
      bucket.totalQuantity += s.quantity;
      bucket.totalAmount =
        Math.round((bucket.totalAmount + line.amount) * 100) / 100;
    }

    const days = [...dayMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const grandTotalQuantity = sales.reduce((a, s) => a + s.quantity, 0);
    const grandTotalAmount =
      Math.round(
        sales.reduce((a, s) => a + lineAmount(s), 0) * 100,
      ) / 100;

    return {
      from: fromStr,
      to: toStr,
      days,
      grandTotalQuantity,
      grandTotalAmount,
    };
  }

  private toLine(s: Sale): ReportLine {
    return {
      id: s.id,
      productName: s.productName,
      unitPrice: s.unitPrice,
      quantity: s.quantity,
      createdAt: s.createdAt,
      amount: lineAmount(s),
    };
  }

  /** Экспорт остатков в .xlsx */
  async exportStockXlsx(): Promise<Buffer> {
    const overview = await this.stockOverview();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Club stock';
    const ws = wb.addWorksheet('Остатки', {
      properties: { defaultRowHeight: 18 },
    });
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Наименование', key: 'name', width: 42 },
      { header: 'Цена', key: 'price', width: 12 },
      { header: 'Остаток', key: 'stock', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const p of overview.items) {
      ws.addRow({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
      });
    }
    ws.addRow({});
    ws.addRow({
      id: '',
      name: 'Всего единиц на складе',
      price: '',
      stock: overview.totalQuantity,
    });
    const last = ws.lastRow;
    if (last) last.font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Экспорт продаж за день в .xlsx */
  async exportDayXlsx(dateStr: string): Promise<Buffer> {
    const rep = await this.reportDay(dateStr);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Продажи за день', {
      properties: { defaultRowHeight: 18 },
    });
    ws.addRow([`Отчёт за ${rep.date}`]);
    ws.getRow(1).font = { bold: true, size: 12 };
    ws.addRow([
      `Всего шт.: ${rep.totalQuantity}; сумма: ${rep.totalAmount.toFixed(2)}`,
    ]);
    ws.addRow([]);
    ws.addRow([
      'Дата и время',
      'Товар',
      'Цена',
      'Кол-во',
      'Сумма',
    ]);
    ws.getRow(4).font = { bold: true };
    for (const l of rep.lines) {
      ws.addRow([
        new Date(l.createdAt),
        l.productName,
        l.unitPrice,
        l.quantity,
        l.amount,
      ]);
    }
    const dtCol = ws.getColumn(1);
    dtCol.numFmt = 'dd.mm.yyyy hh:mm';
    ws.columns = [
      { width: 18 },
      { width: 40 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
    ];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Экспорт продаж за период: лист «По дням» + «Детали» */
  async exportRangeXlsx(fromStr: string, toStr: string): Promise<Buffer> {
    const rep = await this.reportRange(fromStr, toStr);
    const wb = new ExcelJS.Workbook();
    const sum = wb.addWorksheet('По дням', { properties: { defaultRowHeight: 18 } });
    sum.addRow([`Период: ${rep.from} — ${rep.to}`]);
    sum.getRow(1).font = { bold: true };
    sum.addRow([
      `Всего шт.: ${rep.grandTotalQuantity}; сумма: ${rep.grandTotalAmount.toFixed(2)}`,
    ]);
    sum.addRow([]);
    sum.addRow(['Дата', 'Штук', 'Сумма']);
    sum.getRow(4).font = { bold: true };
    for (const d of rep.days) {
      sum.addRow([d.date, d.totalQuantity, d.totalAmount]);
    }

    const det = wb.addWorksheet('Детали', { properties: { defaultRowHeight: 18 } });
    det.addRow([
      'Дата и время',
      'Календарный день',
      'Товар',
      'Цена',
      'Кол-во',
      'Сумма',
    ]);
    det.getRow(1).font = { bold: true };
    for (const d of rep.days) {
      for (const l of d.lines) {
        det.addRow([
          new Date(l.createdAt),
          d.date,
          l.productName,
          l.unitPrice,
          l.quantity,
          l.amount,
        ]);
      }
    }
    det.getColumn(1).numFmt = 'dd.mm.yyyy hh:mm';
    det.columns = [
      { width: 18 },
      { width: 14 },
      { width: 36 },
      { width: 10 },
      { width: 8 },
      { width: 12 },
    ];
    sum.columns = [{ width: 14 }, { width: 10 }, { width: 14 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
