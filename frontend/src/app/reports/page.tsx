"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiDownloadFile, apiGet } from "@/lib/api";

type StockRow = { id: number; name: string; price: number; stock: number };

type ReportLine = {
  id: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  isPersonal: boolean;
  recipientName: string | null;
  createdAt: string;
  amount: number;
};

type DeletedSale = ReportLine & {
  deletedAt: string;
  deletedBy: string | null;
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

export default function ReportsPage() {
  const [stock, setStock] = useState<{
    items: StockRow[];
    totalQuantity: number;
  } | null>(null);
  const [dayDate, setDayDate] = useState(todayInputValue);
  const [dayReport, setDayReport] = useState<DayReport | null>(null);
  const [rangeFrom, setRangeFrom] = useState(todayInputValue);
  const [rangeTo, setRangeTo] = useState(todayInputValue);
  const [rangeReport, setRangeReport] = useState<RangeReport | null>(null);
  const [deletedSales, setDeletedSales] = useState<DeletedSale[] | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);
  const [deletedBusy, setDeletedBusy] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
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

  useEffect(() => {
    void loadStock();
  }, [loadStock]);

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
      await Promise.all([loadStock(), loadDay(), loadRange()]);
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Отчёты
        </h1>
        <p className="mt-2 text-sm text-cyan-100/70">
          Остатки по складу, продажи за день и за период (без фото). Выгрузка в
          Excel — кнопки у каждого блока.
        </p>
      </div>

      {err ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStockOpen((v) => !v)}
            className="flex items-center gap-2 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
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
                className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {exportBusy === "stock" ? "Файл…" : "Excel"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setStockOpen((v) => !v)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {stockOpen ? "Скрыть" : "Открыть"}
            </button>
          </div>
        </div>
        {stockOpen && loading ? (
          <p className="mt-2 text-sm text-zinc-500">Загрузка…</p>
        ) : stockOpen && stock ? (
          <>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Всего единиц на складе:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {stock.totalQuantity}
              </span>
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-zinc-500 dark:text-zinc-400">
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
                      className="border-t border-zinc-100 dark:border-zinc-800"
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="w-full text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:w-auto">
              Отчёт за день
            </h2>
            <label className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Дата</span>
              <input
                type="date"
                className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {exportBusy === "day" ? "Файл…" : "Excel"}
          </button>
        </div>
        {dayReport ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              За день продано единиц:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {dayReport.totalQuantity}
              </span>
              {" · "}
              Сумма:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {dayReport.totalAmount.toFixed(2)}
              </span>
            </p>
            {dayReport.lines.length === 0 ? (
              <p className="text-sm text-zinc-500">Нет продаж в этот день.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Дата и время</th>
                      <th className="py-2 pr-4 font-medium">Товар</th>
                      <th className="py-2 pr-4 font-medium">Кто взял</th>
                      <th className="py-2 pr-4 font-medium">Цена</th>
                      <th className="py-2 font-medium">Кол-во</th>
                      <th className="py-2 font-medium">Сумма</th>
                      <th className="py-2 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayReport.lines.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-4">{fmtTime(l.createdAt)}</td>
                        <td className="py-2 pr-4">{l.productName}</td>
                        <td className="py-2 pr-4">{l.recipientName ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {Number(l.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4">{l.quantity}</td>
                        <td className="py-2 pr-4">{l.amount.toFixed(2)}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            disabled={deleteBusy === l.id}
                            onClick={() => void deleteSale(l.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            {deleteBusy === l.id ? "Удаление…" : "Удалить"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            className="flex items-center gap-2 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
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
                className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {exportBusy === "range" ? "Файл…" : "Excel"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setRangeOpen((v) => !v)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {rangeOpen ? "Скрыть" : "Открыть"}
            </button>
          </div>
        </div>
        {rangeOpen ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">С</span>
              <input
                type="date"
                className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">По</span>
              <input
                type="date"
                className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        {rangeOpen && rangeReport ? (
          <div className="mt-4 space-y-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              За период всего единиц:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {rangeReport.grandTotalQuantity}
              </span>
              {" · "}
              Сумма:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {rangeReport.grandTotalAmount.toFixed(2)}
              </span>
            </p>
            {rangeReport.days.length === 0 ? (
              <p className="text-sm text-zinc-500">Нет продаж в периоде.</p>
            ) : (
              rangeReport.days.map((d) => (
                <div key={d.date}>
                  <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {d.date}{" "}
                    <span className="font-normal text-zinc-500">
                      — единиц: {d.totalQuantity}, сумма:{" "}
                      {d.totalAmount.toFixed(2)}
                    </span>
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="text-zinc-500 dark:text-zinc-400">
                        <tr>
                          <th className="py-2 pr-4 font-medium">
                            Дата и время
                          </th>
                          <th className="py-2 pr-4 font-medium">Товар</th>
                          <th className="py-2 pr-4 font-medium">Кто взял</th>
                          <th className="py-2 pr-4 font-medium">Цена</th>
                          <th className="py-2 font-medium">Кол-во</th>
                          <th className="py-2 font-medium">Сумма</th>
                          <th className="py-2 font-medium">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.lines.map((l) => (
                          <tr
                            key={l.id}
                            className="border-t border-zinc-100 dark:border-zinc-800"
                          >
                            <td className="py-2 pr-4">
                              {fmtTime(l.createdAt)}
                            </td>
                            <td className="py-2 pr-4">{l.productName}</td>
                            <td className="py-2 pr-4">
                              {l.recipientName ?? "—"}
                            </td>
                            <td className="py-2 pr-4">
                              {Number(l.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2 pr-4">{l.quantity}</td>
                            <td className="py-2 pr-4">{l.amount.toFixed(2)}</td>
                            <td className="py-2">
                              <button
                                type="button"
                                disabled={deleteBusy === l.id}
                                onClick={() => void deleteSale(l.id)}
                                className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                              >
                                {deleteBusy === l.id ? "Удаление…" : "Удалить"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      {canViewDeletedSales ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDeletedOpen((v) => !v)}
              className="flex items-start gap-2 text-left"
            >
              <span className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
                {deletedOpen ? "▾" : "▸"}
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Удалённые продажи
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
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
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {deletedBusy ? "Загрузка…" : "Показать удалённые"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDeletedOpen((v) => !v)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {deletedOpen ? "Скрыть" : "Открыть"}
              </button>
            </div>
          </div>
          {deletedOpen && deletedSales ? (
            deletedSales.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                Удалённых продаж нет.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Продано</th>
                      <th className="py-2 pr-4 font-medium">Удалено</th>
                      <th className="py-2 pr-4 font-medium">Кем</th>
                      <th className="py-2 pr-4 font-medium">Товар</th>
                      <th className="py-2 pr-4 font-medium">Кто взял</th>
                      <th className="py-2 pr-4 font-medium">Цена</th>
                      <th className="py-2 pr-4 font-medium">Кол-во</th>
                      <th className="py-2 font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedSales.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-4">{fmtTime(l.createdAt)}</td>
                        <td className="py-2 pr-4">{fmtTime(l.deletedAt)}</td>
                        <td className="py-2 pr-4">{l.deletedBy ?? "—"}</td>
                        <td className="py-2 pr-4">{l.productName}</td>
                        <td className="py-2 pr-4">{l.recipientName ?? "—"}</td>
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
