"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiDownloadFile, apiGet } from "@/lib/api";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/payment";

type StockRow = { id: number; name: string; price: number; stock: number };

type DeferredOverview = {
  totalAmount: number;
  totalQuantity: number;
  debtorCount: number;
  lineCount: number;
};

type ReportLine = {
  id: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  isPersonal: boolean;
  recipientName: string | null;
  debtorName?: string | null;
  isDeferred?: boolean;
  paymentMethod?: PaymentMethod | null;
  acceptedBy?: string | null;
  createdAt: string;
  paidAt?: string | null;
  amount: number;
};

type DeletedSale = ReportLine & {
  deletedAt: string;
  deletedBy: string | null;
};

type StockChangeRow = {
  id: number;
  productId: number;
  productName: string;
  oldStock: number;
  newStock: number;
  changedBy: string;
  createdAt: string;
};

type CurrentUser = {
  login: string;
  role: string;
};

type DayReport = {
  date: string;
  lines: ReportLine[];
  totalQuantity: number;
  totalAmount: number;
};

type RangeReport = {
  from: string;
  to: string;
  days: DayReport[];
  grandTotalQuantity: number;
  grandTotalAmount: number;
};

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lineTime(l: ReportLine): string {
  return l.paidAt || l.createdAt;
}

export default function ReportsPage() {
  const [stock, setStock] = useState<{
    items: StockRow[];
    totalQuantity: number;
  } | null>(null);
  const [deferred, setDeferred] = useState<DeferredOverview | null>(null);
  const [dayDate, setDayDate] = useState(todayInputValue);
  const [dayReport, setDayReport] = useState<DayReport | null>(null);
  const [rangeFrom, setRangeFrom] = useState(todayInputValue);
  const [rangeTo, setRangeTo] = useState(todayInputValue);
  const [rangeReport, setRangeReport] = useState<RangeReport | null>(null);
  const [deletedSales, setDeletedSales] = useState<DeletedSale[] | null>(null);
  const [stockChanges, setStockChanges] = useState<StockChangeRow[] | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);
  const [deletedBusy, setDeletedBusy] = useState(false);
  const [stockChangesBusy, setStockChangesBusy] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [stockChangesOpen, setStockChangesOpen] = useState(false);
  const canViewDeletedSales = currentUser?.login === "admin2026";

  const loadStock = useCallback(async () => {
    setErr(null);
    try {
      const s = await apiGet<{ items: StockRow[]; totalQuantity: number }>(
        "/reports/stock",
      );
      setStock(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeferred = useCallback(async () => {
    try {
      const d = await apiGet<DeferredOverview>("/reports/deferred");
      setDeferred(d);
    } catch {
      setDeferred(null);
    }
  }, []);

  useEffect(() => {
    void loadStock();
    void loadDeferred();
  }, [loadStock, loadDeferred]);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const user = await apiGet<CurrentUser>("/auth/me");
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      }
    }
    void loadCurrentUser();
  }, []);

  const loadDay = useCallback(async () => {
    setErr(null);
    try {
      const r = await apiGet<DayReport>(`/reports/day?date=${dayDate}`);
      setDayReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, [dayDate]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const loadRange = useCallback(async () => {
    setErr(null);
    try {
      const r = await apiGet<RangeReport>(
        `/reports/range?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
      );
      setRangeReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const fmtTime = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  async function exportExcel(key: string, path: string, filename: string) {
    setErr(null);
    setExportBusy(key);
    try {
      await apiDownloadFile(path, filename);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выгрузить Excel");
    } finally {
      setExportBusy(null);
    }
  }

  async function deleteSale(id: number) {
    if (!confirm("Удалить оформленную продажу? Остаток вернётся на склад.")) {
      return;
    }
    setErr(null);
    setDeleteBusy(id);
    try {
      await apiDelete(`/sales/${id}`);
      await Promise.all([loadStock(), loadDay(), loadRange(), loadDeferred()]);
      if (deletedSales) await loadDeletedSales();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось удалить продажу");
    } finally {
      setDeleteBusy(null);
    }
  }

  async function loadDeletedSales() {
    setErr(null);
    setDeletedBusy(true);
    try {
      const items = await apiGet<DeletedSale[]>("/sales/deleted");
      setDeletedSales(items);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Удалённые продажи доступны только admin2026",
      );
    } finally {
      setDeletedBusy(false);
    }
  }

  async function loadStockChanges() {
    setErr(null);
    setStockChangesBusy(true);
    try {
      const res = await apiGet<{ items: StockChangeRow[] }>(
        "/reports/stock-changes",
      );
      setStockChanges(res.items);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось загрузить историю остатков",
      );
    } finally {
      setStockChangesBusy(false);
    }
  }

  function renderSaleRows(lines: ReportLine[]) {
    return lines.map((l) => (
      <tr key={l.id} className="piton-row">
        <td className="py-2 pr-4">{fmtTime(lineTime(l))}</td>
        <td className="py-2 pr-4">{l.productName}</td>
        <td className="py-2 pr-4">
          {l.debtorName ?? l.recipientName ?? "—"}
        </td>
        <td className="py-2 pr-4">{paymentMethodLabel(l.paymentMethod)}</td>
        <td className="py-2 pr-4">{l.acceptedBy ?? "—"}</td>
        <td className="py-2 pr-4">{Number(l.unitPrice).toFixed(2)}</td>
        <td className="py-2 pr-4">{l.quantity}</td>
        <td className="py-2 pr-4">{l.amount.toFixed(2)}</td>
        <td className="py-2">
          <button
            type="button"
            disabled={deleteBusy === l.id}
            onClick={() => void deleteSale(l.id)}
            className="piton-btn-danger px-2 py-1 text-xs disabled:opacity-50"
          >
            {deleteBusy === l.id ? "Удаление…" : "Удалить"}
          </button>
        </td>
      </tr>
    ));
  }

  const saleTableHead = (
    <thead className="piton-muted">
      <tr>
        <th className="py-2 pr-4 font-medium">Дата и время</th>
        <th className="py-2 pr-4 font-medium">Товар</th>
        <th className="py-2 pr-4 font-medium">Кто взял</th>
        <th className="py-2 pr-4 font-medium">Расчёт</th>
        <th className="py-2 pr-4 font-medium">Принял</th>
        <th className="py-2 pr-4 font-medium">Цена</th>
        <th className="py-2 font-medium">Кол-во</th>
        <th className="py-2 font-medium">Сумма</th>
        <th className="py-2 font-medium">Действия</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight piton-title">
          Отчёты
        </h1>
        <p className="mt-2 text-sm piton-muted">
          Остатки по складу, продажи за день и за период (без фото). Неоплаченные
          отложенные платежи в выручку не входят — только после «Оплачен».
          Выгрузка в Excel — кнопки у каждого блока.
        </p>
      </div>

      {err ? (
        <p className="piton-err px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      {deferred ? (
        <section className="rounded-xl border border-lime-400/25 bg-lime-400/10 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-lime-50">
                Отложенные платежи (долги)
              </h2>
              <p className="mt-1 text-sm text-lime-100/80">
                {deferred.debtorCount} чел. · {deferred.lineCount} поз. ·{" "}
                {deferred.totalQuantity} шт. · сумма долга{" "}
                <span className="font-semibold tabular-nums">
                  {deferred.totalAmount.toFixed(2)}
                </span>
              </p>
            </div>
            <Link
              href="/deferred"
              className="rounded-md border border-lime-300/40 bg-lime-300/15 px-3 py-1.5 text-xs font-medium text-lime-50 hover:bg-lime-300/25"
            >
              Открыть список
            </Link>
          </div>
        </section>
      ) : null}

      <section className="piton-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStockOpen((v) => !v)}
            className="flex items-center gap-2 text-left text-sm font-semibold piton-title"
          >
            <span>{stockOpen ? "▾" : "▸"}</span>
            Количество товаров на складе
          </button>
          <div className="flex items-center gap-2">
            {stockOpen ? (
              <button
                type="button"
                disabled={loading || !stock || exportBusy === "stock"}
                onClick={() =>
                  void exportExcel(
                    "stock",
                    "/reports/export/stock",
                    "ostatki.xlsx",
                  )
                }
                className="piton-btn-ghost shrink-0 px-3 py-1.5 text-xs font-medium"
              >
                {exportBusy === "stock" ? "Файл…" : "Excel"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setStockOpen((v) => !v)}
              className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
            >
              {stockOpen ? "Скрыть" : "Открыть"}
            </button>
          </div>
        </div>
        {stockOpen && loading ? (
          <p className="mt-2 text-sm piton-muted">Загрузка…</p>
        ) : stockOpen && stock ? (
          <>
            <p className="mt-2 text-sm piton-label">
              Всего единиц на складе:{" "}
              <span className="font-medium piton-title">
                {stock.totalQuantity}
              </span>
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="piton-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Наименование</th>
                    <th className="py-2 pr-4 font-medium">Цена</th>
                    <th className="py-2 font-medium">Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.items.map((r) => (
                    <tr
                      key={r.id}
                      className="piton-row"
                    >
                      <td className="py-2 pr-4">{r.name}</td>
                      <td className="py-2 pr-4">
                        {Number(r.price).toFixed(2)}
                      </td>
                      <td className="py-2">{r.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="piton-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !stockChangesOpen;
              setStockChangesOpen(next);
              if (next && !stockChanges) void loadStockChanges();
            }}
            className="flex items-start gap-2 text-left"
          >
            <span className="mt-0.5 text-sm piton-title">
              {stockChangesOpen ? "▾" : "▸"}
            </span>
            <span>
              <span className="block text-sm font-semibold piton-title">
                История изменений количества
              </span>
              <span className="mt-1 block text-xs piton-muted">
                Кто и когда менял остаток товара в карточке товара.
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {stockChangesOpen ? (
              <button
                type="button"
                disabled={stockChangesBusy}
                onClick={() => void loadStockChanges()}
                className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
              >
                {stockChangesBusy ? "Загрузка…" : "Обновить"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = !stockChangesOpen;
                setStockChangesOpen(next);
                if (next && !stockChanges) void loadStockChanges();
              }}
              className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
            >
              {stockChangesOpen ? "Скрыть" : "Открыть"}
            </button>
          </div>
        </div>
        {stockChangesOpen && stockChangesBusy && !stockChanges ? (
          <p className="mt-3 text-sm piton-muted">Загрузка…</p>
        ) : null}
        {stockChangesOpen && stockChanges ? (
          stockChanges.length === 0 ? (
            <p className="mt-3 text-sm piton-muted">
              Изменений количества пока нет.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="piton-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Дата и время</th>
                    <th className="py-2 pr-4 font-medium">Товар</th>
                    <th className="py-2 pr-4 font-medium">Было</th>
                    <th className="py-2 pr-4 font-medium">Стало</th>
                    <th className="py-2 pr-4 font-medium">Δ</th>
                    <th className="py-2 font-medium">Кто изменил</th>
                  </tr>
                </thead>
                <tbody>
                  {stockChanges.map((c) => {
                    const delta = c.newStock - c.oldStock;
                    return (
                      <tr key={c.id} className="piton-row">
                        <td className="py-2 pr-4">{fmtTime(c.createdAt)}</td>
                        <td className="py-2 pr-4">{c.productName}</td>
                        <td className="py-2 pr-4 tabular-nums">{c.oldStock}</td>
                        <td className="py-2 pr-4 tabular-nums">{c.newStock}</td>
                        <td className="py-2 pr-4 tabular-nums">
                          {delta > 0 ? `+${delta}` : delta}
                        </td>
                        <td className="py-2">{c.changedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>

      <section className="piton-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="w-full text-sm font-semibold piton-title sm:w-auto">
              Отчёт за день
            </h2>
            <label className="text-sm">
              <span className="piton-label">Дата</span>
              <input
                type="date"
                className="ml-2 piton-input px-2 py-1.5 text-sm"
                value={dayDate}
                onChange={(e) => setDayDate(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={exportBusy === "day"}
            onClick={() =>
              void exportExcel(
                "day",
                `/reports/export/day?date=${encodeURIComponent(dayDate)}`,
                `prodazhi-den-${dayDate}.xlsx`,
              )
            }
            className="piton-btn-ghost shrink-0 px-3 py-1.5 text-xs font-medium"
          >
            {exportBusy === "day" ? "Файл…" : "Excel"}
          </button>
        </div>
        {dayReport ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm piton-label">
              За день продано единиц:{" "}
              <span className="font-medium piton-title">
                {dayReport.totalQuantity}
              </span>
              {" · "}
              Сумма:{" "}
              <span className="font-medium piton-title">
                {dayReport.totalAmount.toFixed(2)}
              </span>
            </p>
            {dayReport.lines.length === 0 ? (
              <p className="text-sm piton-muted">Нет продаж в этот день.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  {saleTableHead}
                  <tbody>{renderSaleRows(dayReport.lines)}</tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="piton-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            className="flex items-center gap-2 text-left text-sm font-semibold piton-title"
          >
            <span>{rangeOpen ? "▾" : "▸"}</span>
            Отчёт за период (по дням)
          </button>
          <div className="flex items-center gap-2">
            {rangeOpen ? (
              <button
                type="button"
                disabled={exportBusy === "range"}
                onClick={() =>
                  void exportExcel(
                    "range",
                    `/reports/export/range?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
                    `prodazhi-${rangeFrom}_${rangeTo}.xlsx`,
                  )
                }
                className="piton-btn-ghost shrink-0 px-3 py-1.5 text-xs font-medium"
              >
                {exportBusy === "range" ? "Файл…" : "Excel"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setRangeOpen((v) => !v)}
              className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
            >
              {rangeOpen ? "Скрыть" : "Открыть"}
            </button>
          </div>
        </div>
        {rangeOpen ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="piton-label">С</span>
              <input
                type="date"
                className="ml-2 piton-input px-2 py-1.5 text-sm"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="piton-label">По</span>
              <input
                type="date"
                className="ml-2 piton-input px-2 py-1.5 text-sm"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        {rangeOpen && rangeReport ? (
          <div className="mt-4 space-y-6">
            <p className="text-sm piton-label">
              За период всего единиц:{" "}
              <span className="font-medium piton-title">
                {rangeReport.grandTotalQuantity}
              </span>
              {" · "}
              Сумма:{" "}
              <span className="font-medium piton-title">
                {rangeReport.grandTotalAmount.toFixed(2)}
              </span>
            </p>
            {rangeReport.days.length === 0 ? (
              <p className="text-sm piton-muted">Нет продаж в периоде.</p>
            ) : (
              rangeReport.days.map((d) => (
                <div key={d.date}>
                  <h3 className="text-sm font-medium piton-title">
                    {d.date}{" "}
                    <span className="font-normal piton-muted">
                      — единиц: {d.totalQuantity}, сумма:{" "}
                      {d.totalAmount.toFixed(2)}
                    </span>
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      {saleTableHead}
                      <tbody>{renderSaleRows(d.lines)}</tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      {canViewDeletedSales ? (
        <section className="piton-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDeletedOpen((v) => !v)}
              className="flex items-start gap-2 text-left"
            >
              <span className="mt-0.5 text-sm piton-title">
                {deletedOpen ? "▾" : "▸"}
              </span>
              <span>
                <span className="block text-sm font-semibold piton-title">
                  Удалённые продажи
                </span>
                <span className="mt-1 block text-xs piton-muted">
                  Просмотр доступен только под учёткой admin2026.
                </span>
              </span>
            </button>
            <div className="flex items-center gap-2">
              {deletedOpen ? (
                <button
                  type="button"
                  disabled={deletedBusy}
                  onClick={() => void loadDeletedSales()}
                  className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
                >
                  {deletedBusy ? "Загрузка…" : "Показать удалённые"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDeletedOpen((v) => !v)}
                className="piton-btn-ghost px-3 py-1.5 text-xs font-medium"
              >
                {deletedOpen ? "Скрыть" : "Открыть"}
              </button>
            </div>
          </div>
          {deletedOpen && deletedSales ? (
            deletedSales.length === 0 ? (
              <p className="mt-3 text-sm piton-muted">
                Удалённых продаж нет.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="piton-muted">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Продано</th>
                      <th className="py-2 pr-4 font-medium">Удалено</th>
                      <th className="py-2 pr-4 font-medium">Кем</th>
                      <th className="py-2 pr-4 font-medium">Товар</th>
                      <th className="py-2 pr-4 font-medium">Кто взял</th>
                      <th className="py-2 pr-4 font-medium">Расчёт</th>
                      <th className="py-2 pr-4 font-medium">Принял</th>
                      <th className="py-2 pr-4 font-medium">Цена</th>
                      <th className="py-2 pr-4 font-medium">Кол-во</th>
                      <th className="py-2 font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedSales.map((l) => (
                      <tr
                        key={l.id}
                        className="piton-row"
                      >
                        <td className="py-2 pr-4">{fmtTime(l.createdAt)}</td>
                        <td className="py-2 pr-4">{fmtTime(l.deletedAt)}</td>
                        <td className="py-2 pr-4">{l.deletedBy ?? "—"}</td>
                        <td className="py-2 pr-4">{l.productName}</td>
                        <td className="py-2 pr-4">{l.recipientName ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {paymentMethodLabel(l.paymentMethod)}
                        </td>
                        <td className="py-2 pr-4">{l.acceptedBy ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {Number(l.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4">{l.quantity}</td>
                        <td className="py-2">{l.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
