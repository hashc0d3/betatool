"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatchJson, apiPostJson } from "@/lib/api";

type DeferredLine = {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  isPersonal: boolean;
  recipientName: string | null;
  debtorName: string | null;
  createdAt: string;
  amount: number;
};

type PersonGroup = {
  name: string;
  lines: DeferredLine[];
  totalQty: number;
  totalAmount: number;
};

export default function DeferredPaymentsPage() {
  const [items, setItems] = useState<DeferredLine[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async (q?: string) => {
    setError(null);
    try {
      const query = (q ?? search).trim();
      const path = query
        ? `/sales/deferred?q=${encodeURIComponent(query)}`
        : "/sales/deferred";
      const list = await apiGet<DeferredLine[]>(path);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(search);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, load]);

  const groups = useMemo((): PersonGroup[] => {
    const map = new Map<string, DeferredLine[]>();
    for (const line of items) {
      const name = line.debtorName?.trim() || "Без имени";
      const list = map.get(name) ?? [];
      list.push(line);
      map.set(name, list);
    }
    return [...map.entries()]
      .map(([name, lines]) => {
        const totalQty = lines.reduce((a, l) => a + l.quantity, 0);
        const totalAmount =
          Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
        return { name, lines, totalQty, totalAmount };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [items]);

  const grandTotal = useMemo(
    () =>
      Math.round(groups.reduce((a, g) => a + g.totalAmount, 0) * 100) / 100,
    [groups],
  );

  function startEdit(name: string) {
    setEditingName(name);
    setEditValue(name);
    setMessage(null);
    setError(null);
  }

  async function saveName(from: string) {
    const to = editValue.trim();
    if (!to) {
      setError("Имя не может быть пустым");
      return;
    }
    setBusy(`rename:${from}`);
    setError(null);
    try {
      await apiPatchJson("/sales/deferred/rename", { from, to });
      setEditingName(null);
      setMessage(`Имя обновлено: ${to}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения имени");
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(name: string) {
    if (!confirm(`Отметить оплаченным долг «${name}»? Сумма попадёт в отчёт.`)) {
      return;
    }
    setBusy(`pay:${name}`);
    setError(null);
    try {
      await apiPostJson("/sales/deferred/pay", { debtorName: name });
      setMessage(`Оплачено: ${name}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оплаты");
    } finally {
      setBusy(null);
    }
  }

  async function removeGroup(name: string) {
    if (
      !confirm(
        `Удалить отложенный платёж «${name}»? Товары вернутся на склад.`,
      )
    ) {
      return;
    }
    setBusy(`remove:${name}`);
    setError(null);
    try {
      await apiPostJson("/sales/deferred/remove", { debtorName: name });
      setMessage(`Удалено: ${name}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight piton-title">
          Отложенные платежи
        </h1>
        <p className="mt-2 text-sm piton-muted">
          Долги по товарам. Поиск группирует по имени. Оплата учитывается в
          отчётах; удаление возвращает товар на склад.
        </p>
      </div>

      {message ? (
        <p className="piton-ok px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="piton-err px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[260px] flex-1 text-sm font-medium piton-label">
          Поиск по имени
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Начните вводить имя…"
            className="mt-1.5 w-full piton-input px-3 py-2 text-sm"
          />
        </label>
        <p className="pb-2 text-sm piton-muted">
          Групп: {groups.length} · долг: {grandTotal.toFixed(2)}
        </p>
      </div>

      {loading ? (
        <p className="text-sm piton-muted">Загрузка…</p>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lime-400/20 py-12 text-center text-sm piton-muted">
          {search.trim()
            ? "По этому имени ничего не найдено"
            : "Открытых отложенных платежей нет"}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isBusy = busy?.endsWith(`:${g.name}`) ?? false;
            const isEditing = editingName === g.name;
            return (
              <section
                key={g.name}
                className="overflow-hidden piton-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-lime-400/15 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveName(g.name);
                            if (e.key === "Escape") setEditingName(null);
                          }}
                          className="min-w-[180px] flex-1 piton-input px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void saveName(g.name)}
                          className="piton-btn px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setEditingName(null)}
                          className="rounded-md border border-lime-400/20 px-3 py-1.5 text-xs piton-label"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-white">
                          {g.name}
                        </h2>
                        <p className="mt-0.5 text-xs piton-muted">
                          {g.totalQty} шт. · {g.totalAmount.toFixed(2)} ·{" "}
                          {g.lines.length} поз.
                        </p>
                      </>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => startEdit(g.name)}
                        className="piton-btn-ghost px-3 py-1.5 text-xs"
                      >
                        Изменить имя
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void markPaid(g.name)}
                        className="piton-btn px-3 py-1.5 text-xs"
                      >
                        {busy === `pay:${g.name}` ? "…" : "Оплачен"}
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void removeGroup(g.name)}
                        className="piton-btn-danger px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {busy === `remove:${g.name}` ? "…" : "Удалить"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <ul className="divide-y divide-white/5">
                  {g.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium piton-title">
                          {line.productName}
                        </p>
                        <p className="text-xs piton-muted">
                          {new Date(line.createdAt).toLocaleString("ru-RU")}
                          {line.isPersonal
                            ? ` · персоналка${
                                line.recipientName
                                  ? `: ${line.recipientName}`
                                  : ""
                              }`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right tabular-nums piton-label">
                        <div>
                          {Number(line.unitPrice).toFixed(2)} × {line.quantity}
                        </div>
                        <div className="text-xs piton-muted">
                          {line.amount.toFixed(2)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
