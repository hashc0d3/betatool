"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPostJson, assetUrl } from "@/lib/api";

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl: string | null;
  isPersonal: boolean;
};

type CartLine = {
  lineId: string;
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  isPersonal: boolean;
  recipientName: string | null;
};

function qtyForProduct(cart: CartLine[], productId: number): number {
  return cart
    .filter((l) => l.productId === productId)
    .reduce((sum, l) => sum + l.quantity, 0);
}

export default function SalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("default");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  /** Количество к добавлению с карточки (строка для input) */
  const [addQtyByProduct, setAddQtyByProduct] = useState<
    Record<number, string>
  >({});
  const [recipientByProduct, setRecipientByProduct] = useState<
    Record<number, string>
  >({});
  const [personalByProduct, setPersonalByProduct] = useState<
    Record<number, boolean>
  >({});
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await apiGet<Product[]>("/products");
      setProducts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCategories = useCallback(async () => {
    try {
      const list = await apiGet<Category[]>("/categories");
      setCategories(list);
      if (!list.some((c) => c.name === selectedCategory)) {
        setSelectedCategory(list[0]?.name ?? "default");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки категорий");
    }
  }, [selectedCategory]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  const productById = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const category = p.category || "default";
      if (category !== selectedCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [products, search, selectedCategory]);

  function draftQtyFor(productId: number): string {
    return addQtyByProduct[productId] ?? "1";
  }

  function setDraftQty(productId: number, value: string) {
    setAddQtyByProduct((prev) => ({ ...prev, [productId]: value }));
  }

  function recipientFor(productId: number): string {
    return recipientByProduct[productId] ?? "";
  }

  function setRecipient(productId: number, value: string) {
    setRecipientByProduct((prev) => ({ ...prev, [productId]: value }));
  }

  function personalFor(p: Product): boolean {
    return p.isPersonal || personalByProduct[p.id] === true;
  }

  function setPersonal(productId: number, value: boolean) {
    setPersonalByProduct((prev) => ({ ...prev, [productId]: value }));
  }

  function addToCart(p: Product) {
    setMessage(null);
    setError(null);
    if (p.stock <= 0) return;
    const inCart = qtyForProduct(cart, p.id);
    const maxAdd = p.stock - inCart;
    if (maxAdd <= 0) {
      setError("Этот товар уже полностью в корзине по остатку");
      return;
    }

    const raw = draftQtyFor(p.id).trim().replace(",", ".");
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) {
      setError("Укажите целое количество не меньше 1");
      return;
    }
    if (n > maxAdd) {
      setError(`Можно добавить не больше ${maxAdd} шт.`);
      return;
    }
    const isPersonal = personalFor(p);
    const recipientName = isPersonal ? recipientFor(p.id).trim() : "";
    if (isPersonal && !recipientName) {
      setError("Для персоналки укажите имя кто взял");
      return;
    }

    setCart((prev) => {
      const i = prev.findIndex(
        (l) =>
          l.productId === p.id && l.recipientName === (recipientName || null),
      );
      if (i === -1) {
        return [
          ...prev,
          {
            lineId: `${p.id}:${recipientName ? `personal:${recipientName}` : "regular"}`,
            productId: p.id,
            name: p.name,
            unitPrice: p.price,
            quantity: n,
            imageUrl: p.imageUrl,
            isPersonal,
            recipientName: recipientName || null,
          },
        ];
      }
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + n };
      return next;
    });
    setDraftQty(p.id, "1");
    if (isPersonal) setRecipient(p.id, "");
    setCartOpen(true);
  }

  function setLineQuantity(lineId: string, quantity: number) {
    setError(null);
    const line = cart.find((l) => l.lineId === lineId);
    if (!line) return;
    const p = productById.get(line.productId);
    if (!p) return;
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.lineId !== lineId));
      return;
    }
    const otherQty = qtyForProduct(cart, p.id) - line.quantity;
    if (otherQty + quantity > p.stock) {
      setError("Недостаточно товара на складе");
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
    );
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  const cartTotals = useMemo(() => {
    let qty = 0;
    let sum = 0;
    for (const l of cart) {
      qty += l.quantity;
      sum += l.unitPrice * l.quantity;
    }
    return {
      qty,
      sum: Math.round(sum * 100) / 100,
    };
  }, [cart]);

  async function checkout() {
    if (cart.length === 0) return;
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      for (let i = 0; i < cart.length; i++) {
        const line = cart[i];
        try {
          await apiPostJson("/sales", {
            productId: line.productId,
            quantity: line.quantity,
            recipientName: line.recipientName ?? undefined,
            isPersonal: line.isPersonal,
          });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Ошибка при оформлении. Часть позиций могла сохраниться — проверьте отчёты.",
          );
          setCart(cart.slice(i));
          await load();
          return;
        }
      }
      setCart([]);
      setMessage("Продажи записаны, остатки обновлены");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Регистрация продажи
        </h1>
        <p className="mt-2 text-sm text-cyan-100/70">
          Корзина — сайдбар справа; при добавлении товара открывается сама. Её
          можно скрыть кнопкой «×» или снова открыть с полоски справа.
        </p>
      </div>

      {message ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Нет товаров. Сначала добавьте их в разделе «Товары».
        </p>
      ) : (
        <>
          {cartOpen ? (
            <div
              role="presentation"
              className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[1px] lg:hidden"
              onClick={() => setCartOpen(false)}
            />
          ) : null}

          {!cartOpen ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="fixed z-50 flex flex-col items-center justify-center gap-1 border border-zinc-200 bg-white text-zinc-900 shadow-lg transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 max-lg:bottom-6 max-lg:right-4 max-lg:rounded-full max-lg:px-4 max-lg:py-3 lg:right-0 lg:top-[45%] lg:w-12 lg:-translate-y-1/2 lg:rounded-l-xl lg:rounded-r-none lg:border-r-0 lg:px-1 lg:py-8"
            >
              <span className="text-xs font-semibold tracking-tight lg:[writing-mode:vertical-rl] lg:rotate-180">
                Корзина
              </span>
              {cartTotals.qty > 0 ? (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900">
                  {cartTotals.qty}
                </span>
              ) : null}
            </button>
          ) : null}

          <aside
            className={`fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,380px)] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
              cartOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Корзина
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {cart.length === 0
                    ? "Пока пусто"
                    : `${cartTotals.qty} шт. · ${cartTotals.sum.toFixed(2)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="shrink-0 rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Скрыть корзину"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Укажите количество на карточке и нажмите «Добавить в корзину»
                </p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((line) => {
                    const img = assetUrl(line.imageUrl);
                    const p = productById.get(line.productId);
                    const max =
                      (p?.stock ?? line.quantity) -
                      (qtyForProduct(cart, line.productId) - line.quantity);
                    return (
                      <li
                        key={line.lineId}
                        className="flex gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {line.name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {Number(line.unitPrice).toFixed(2)} ×{" "}
                            {line.quantity}
                          </p>
                          {line.recipientName ? (
                            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                              Кто взял: {line.recipientName}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Меньше"
                              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-sm dark:border-zinc-600"
                              onClick={() =>
                                setLineQuantity(line.lineId, line.quantity - 1)
                              }
                            >
                              −
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Больше"
                              disabled={line.quantity >= max}
                              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-sm disabled:opacity-40 dark:border-zinc-600"
                              onClick={() =>
                                setLineQuantity(line.lineId, line.quantity + 1)
                              }
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="ml-auto text-xs text-red-600 hover:underline dark:text-red-400"
                              onClick={() => removeLine(line.lineId)}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => void checkout()}
                className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {submitting ? "Оформление…" : "Оформить продажу"}
              </button>
            </div>
          </aside>

          <div
            className={`space-y-4 pr-0 max-lg:pb-24 ${cartOpen ? "lg:pr-0" : "lg:pr-14"}`}
          >
            <div>
              <div className="flex flex-wrap gap-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Категория
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="mt-1.5 block w-56 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Поиск по товарам
                  <input
                    type="search"
                    autoComplete="off"
                    placeholder="Начните вводить название…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-1.5 block w-full min-w-[260px] max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Категория: {selectedCategory} · найдено:{" "}
                {filteredProducts.length}
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
                В категории «{selectedCategory}» ничего не найдено
              </p>
            ) : (
              <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((p) => {
                  const img = assetUrl(p.imageUrl);
                  const unavailable = p.stock <= 0;
                  const inCart = qtyForProduct(cart, p.id);
                  const maxAdd = p.stock - inCart;
                  const canAdd = !unavailable && maxAdd > 0;
                  const draft = draftQtyFor(p.id);
                  const draftNum = Math.floor(
                    Number(draft.trim().replace(",", ".")),
                  );
                  const draftOk =
                    Number.isFinite(draftNum) &&
                    draftNum >= 1 &&
                    draftNum <= maxAdd;
                  const personalSelected = personalFor(p);
                  const recipientOk =
                    !personalSelected || recipientFor(p.id).trim().length > 0;
                  return (
                    <article
                      key={p.id}
                      className={`flex h-full min-h-[26rem] flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-950 ${
                        unavailable
                          ? "border-zinc-100 opacity-70 dark:border-zinc-800"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!canAdd || !draftOk || !recipientOk}
                        onClick={() => addToCart(p)}
                        className="relative h-48 w-full shrink-0 overflow-hidden bg-zinc-100 text-left transition hover:brightness-95 disabled:cursor-not-allowed disabled:hover:brightness-100 dark:bg-zinc-900"
                        aria-label={`Добавить ${p.name} в корзину`}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                            Нет фото
                          </div>
                        )}
                        {unavailable ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                            Нет в наличии
                          </span>
                        ) : null}
                      </button>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <h2 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {p.name}
                        </h2>
                        <span className="w-fit rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                          {p.category || "default"}
                        </span>
                        <div className="flex items-end justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <span>{Number(p.price).toFixed(2)}</span>
                          <span className="tabular-nums">Склад: {p.stock}</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            disabled={p.isPersonal || !canAdd}
                            checked={personalSelected}
                            onChange={(e) =>
                              setPersonal(p.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-zinc-300 disabled:opacity-60"
                          />
                          <span>Персонал</span>
                          {p.isPersonal ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              обязательно
                            </span>
                          ) : null}
                        </label>
                        {inCart > 0 ? (
                          <p className="text-xs text-zinc-500">
                            Уже в корзине: {inCart} шт. · можно ещё: {maxAdd}
                          </p>
                        ) : null}
                        {personalSelected ? (
                          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                            Имя кто взял
                            <input
                              type="text"
                              disabled={!canAdd}
                              value={recipientFor(p.id)}
                              onChange={(e) =>
                                setRecipient(p.id, e.target.value)
                              }
                              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                              placeholder="Например: Иван"
                            />
                          </label>
                        ) : null}
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                          Количество
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, maxAdd)}
                            disabled={!canAdd}
                            value={draft}
                            onChange={(e) => setDraftQty(p.id, e.target.value)}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!canAdd || !draftOk || !recipientOk}
                          onClick={() => addToCart(p)}
                          className="mt-auto w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          {unavailable ? "Нет в наличии" : "Добавить в корзину"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
