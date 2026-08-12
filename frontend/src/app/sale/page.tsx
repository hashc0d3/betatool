"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { apiGet, apiPatchJson, apiPostJson, assetUrl } from "@/lib/api";
import {
  DEFAULT_PAYMENT_METHOD,
  type PaymentMethod,
} from "@/lib/payment";

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
  sortOrder?: number;
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

/** Виртуальная категория: показать все товары */
const ALL_PRODUCTS = "__all__";

function qtyForProduct(cart: CartLine[], productId: number): number {
  return cart
    .filter((l) => l.productId === productId)
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** Переставить элемент видимого списка, сохранив позиции скрытых. */
function reorderByVisible(
  all: Product[],
  visible: Product[],
  fromVisibleIdx: number,
  toVisibleIdx: number,
): Product[] {
  if (
    fromVisibleIdx === toVisibleIdx ||
    fromVisibleIdx < 0 ||
    toVisibleIdx < 0 ||
    fromVisibleIdx >= visible.length ||
    toVisibleIdx >= visible.length
  ) {
    return all;
  }
  const visibleIds = visible.map((p) => p.id);
  const [moved] = visibleIds.splice(fromVisibleIdx, 1);
  visibleIds.splice(toVisibleIdx, 0, moved);

  const idSet = new Set(visibleIds);
  const byId = new Map(all.map((p) => [p.id, p]));
  const result: Product[] = [];
  let vi = 0;
  for (const p of all) {
    if (idSet.has(p.id)) {
      const id = visibleIds[vi++];
      result.push(byId.get(id)!);
    } else {
      result.push(p);
    }
  }
  return result;
}

function isDragIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, select, textarea, label, a, [data-no-drag]"),
  );
}

export default function SalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_PRODUCTS);
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
  const [deferredOpen, setDeferredOpen] = useState(false);
  const [debtorName, setDebtorName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    DEFAULT_PAYMENT_METHOD,
  );
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel =
    selectedCategory === ALL_PRODUCTS ? "Все товары" : selectedCategory;

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
      if (
        selectedCategory !== ALL_PRODUCTS &&
        !list.some((c) => c.name === selectedCategory)
      ) {
        setSelectedCategory(ALL_PRODUCTS);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки категорий");
    }
  }, [selectedCategory]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const productById = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== ALL_PRODUCTS) {
        const category = p.category || "default";
        if (category !== selectedCategory) return false;
      }
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

  async function persistOrder(next: Product[]) {
    setReorderBusy(true);
    setError(null);
    try {
      const saved = await apiPatchJson<Product[]>("/products/reorder", {
        ids: next.map((p) => p.id),
      });
      setProducts(saved);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить порядок карточек",
      );
      await load();
    } finally {
      setReorderBusy(false);
    }
  }

  function onCardDragStart(e: DragEvent, productId: number) {
    if (isDragIgnoredTarget(e.target) || reorderBusy) {
      e.preventDefault();
      return;
    }
    setDragId(productId);
    setDragOverId(productId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(productId));
    // Немного прозрачности «призрака» перетаскивания
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.55";
    }
  }

  function onCardDragEnd(e: DragEvent) {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
    setDragId(null);
    setDragOverId(null);
  }

  function onCardDragOver(e: DragEvent, productId: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== productId) setDragOverId(productId);
  }

  function onCardDrop(e: DragEvent, toProductId: number) {
    e.preventDefault();
    const fromId = dragId ?? Number(e.dataTransfer.getData("text/plain"));
    setDragId(null);
    setDragOverId(null);
    if (!Number.isFinite(fromId) || fromId === toProductId || reorderBusy) {
      return;
    }
    const fromIdx = filteredProducts.findIndex((p) => p.id === fromId);
    const toIdx = filteredProducts.findIndex((p) => p.id === toProductId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = reorderByVisible(products, filteredProducts, fromIdx, toIdx);
    setProducts(next);
    void persistOrder(next);
  }

  const checkout = useCallback(async () => {
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
            paymentMethod,
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
      setPaymentMethod(DEFAULT_PAYMENT_METHOD);
      setMessage("Продажи записаны, остатки обновлены");
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [cart, load, paymentMethod]);

  useEffect(() => {
    if (!cartOpen && !deferredOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deferredOpen) {
          setDeferredOpen(false);
          return;
        }
        setCartOpen(false);
        return;
      }
      if (e.key !== "Enter" || e.repeat) return;
      if (deferredOpen || !cartOpen || submitting || cart.length === 0) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Не перехватывать Enter в полях ввода (поиск, кол-во и т.п.)
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      void checkout();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, deferredOpen, submitting, cart.length, checkout]);

  async function submitDeferred() {
    if (cart.length === 0) return;
    const name = debtorName.trim();
    if (!name) {
      setError("Укажите имя кто взял товар");
      return;
    }
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await apiPostJson("/sales/deferred", {
        debtorName: name,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          recipientName: line.recipientName ?? undefined,
          isPersonal: line.isPersonal,
        })),
      });
      setCart([]);
      setDebtorName("");
      setDeferredOpen(false);
      setMessage("Отложенный платёж создан, остатки обновлены");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка создания отложенного платежа",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight piton-title">
          Регистрация продажи
        </h1>
        <p className="mt-2 text-sm piton-muted">
          Корзина — сайдбар справа; при добавлении товара открывается сама. Её
          можно скрыть кнопкой «×» или снова открыть с полоски справа. Карточки
          можно переставлять: зажмите левую кнопку мыши на карточке (не на
          кнопках и полях) и перетащите.
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

      {loading ? (
        <p className="text-sm piton-muted">Загрузка…</p>
      ) : products.length === 0 ? (
        <p className="text-sm piton-muted">
          Нет товаров. Сначала добавьте их в разделе «Товары».
        </p>
      ) : (
        <>
          {cartOpen ? (
            <div
              role="presentation"
              className="fixed inset-0 z-40 bg-[#04150c]/60 backdrop-blur-[1px] lg:hidden"
              onClick={() => setCartOpen(false)}
            />
          ) : null}

          {!cartOpen ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="fixed z-50 flex flex-col items-center justify-center gap-1 border border-lime-400/25 bg-[#0a2414] text-lime-100 shadow-lg transition hover:bg-[#0d2e1a] max-lg:bottom-6 max-lg:right-4 max-lg:rounded-full max-lg:px-4 max-lg:py-3 lg:right-0 lg:top-[45%] lg:w-12 lg:-translate-y-1/2 lg:rounded-l-xl lg:rounded-r-none lg:border-r-0 lg:px-1 lg:py-8"
            >
              <span className="text-xs font-semibold tracking-tight lg:[writing-mode:vertical-rl] lg:rotate-180">
                Корзина
              </span>
              {cartTotals.qty > 0 ? (
                <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-bold text-green-950 tabular-nums">
                  {cartTotals.qty}
                </span>
              ) : null}
            </button>
          ) : null}

          <aside
            className={`fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,380px)] flex-col border-l border-lime-400/20 bg-[#0a2414] shadow-2xl transition-transform duration-300 ease-out ${
              cartOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-lime-400/15 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold piton-title">
                  Корзина
                </h2>
                <p className="mt-0.5 text-xs piton-muted">
                  {cart.length === 0
                    ? "Пока пусто"
                    : `${cartTotals.qty} шт. · ${cartTotals.sum.toFixed(2)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="shrink-0 rounded-md p-2 piton-muted transition hover:bg-lime-400/10 hover:text-lime-50"
                aria-label="Скрыть корзину"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm piton-muted">
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
                        className="flex gap-3 rounded-lg border border-lime-400/15 bg-[#071a0f] p-2"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#071a0f]">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] piton-muted">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium piton-title">
                            {line.name}
                          </p>
                          <p className="mt-0.5 text-xs piton-muted">
                            {Number(line.unitPrice).toFixed(2)} ×{" "}
                            {line.quantity}
                          </p>
                          {line.recipientName ? (
                            <p className="mt-0.5 text-xs text-lime-300">
                              Кто взял: {line.recipientName}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Меньше"
                              className="flex h-7 w-7 items-center justify-center rounded border border-lime-400/25 text-sm text-lime-100"
                              onClick={() =>
                                setLineQuantity(line.lineId, line.quantity - 1)
                              }
                            >
                              −
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm tabular-nums text-lime-50">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Больше"
                              disabled={line.quantity >= max}
                              className="flex h-7 w-7 items-center justify-center rounded border border-lime-400/25 text-sm text-lime-100 disabled:opacity-40"
                              onClick={() =>
                                setLineQuantity(line.lineId, line.quantity + 1)
                              }
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="ml-auto text-xs text-red-300 hover:underline"
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

            <div className="shrink-0 space-y-2 border-t border-lime-400/15 p-3">
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium piton-label">
                  Способ расчёта
                </legend>
                <div className="flex gap-2">
                  <label
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs transition ${
                      paymentMethod === "cashless"
                        ? "border-lime-400/50 bg-lime-400/15 text-lime-50"
                        : "border-lime-400/20 piton-muted hover:border-lime-400/35"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      className="sr-only"
                      checked={paymentMethod === "cashless"}
                      onChange={() => setPaymentMethod("cashless")}
                    />
                    Безналичный
                  </label>
                  <label
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs transition ${
                      paymentMethod === "cash"
                        ? "border-lime-400/50 bg-lime-400/15 text-lime-50"
                        : "border-lime-400/20 piton-muted hover:border-lime-400/35"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      className="sr-only"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                    />
                    Наличный
                  </label>
                </div>
              </fieldset>
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => void checkout()}
                className="w-full piton-btn w-full py-2.5 text-sm"
              >
                {submitting ? "Оформление…" : "Оформить продажу"}
              </button>
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => {
                  setError(null);
                  setDeferredOpen(true);
                }}
                className="piton-btn-ghost w-full py-2.5 text-sm font-medium"
              >
                Отложенный платёж
              </button>
            </div>
          </aside>

          {deferredOpen ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-[#04150c]/70 p-4 backdrop-blur-sm"
              role="presentation"
              onClick={() => {
                if (!submitting) setDeferredOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="deferred-title"
                className="piton-card w-full max-w-md p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="deferred-title"
                  className="text-lg font-semibold text-white"
                >
                  Отложенный платёж
                </h2>
                <p className="mt-1 text-sm piton-muted">
                  Товар спишется со склада, сумма попадёт в отчёт после оплаты.
                  Сумма: {cartTotals.sum.toFixed(2)} · {cartTotals.qty} шт.
                </p>
                <label className="mt-4 block text-sm font-medium piton-label">
                  Имя кто взял товар
                  <input
                    autoFocus
                    type="text"
                    value={debtorName}
                    onChange={(e) => setDebtorName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitDeferred();
                      }
                    }}
                    placeholder="Например, Иван"
                    className="mt-1.5 w-full piton-input px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setDeferredOpen(false)}
                    className="piton-btn-ghost flex-1 px-3 py-2 text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !debtorName.trim()}
                    onClick={() => void submitDeferred()}
                    className="piton-btn flex-1 px-3 py-2 text-sm"
                  >
                    {submitting ? "Сохранение…" : "Создать"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`space-y-4 pr-0 max-lg:pb-24 ${cartOpen ? "lg:pr-0" : "lg:pr-14"}`}
          >
            <div>
              <div className="flex flex-wrap gap-3">
                <label className="block text-sm font-medium piton-label">
                  Категория
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="mt-1.5 block w-56 piton-input px-3 py-2 text-sm"
                  >
                    <option value={ALL_PRODUCTS}>Все товары</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium piton-label">
                  Поиск по товарам
                  <input
                    type="search"
                    autoComplete="off"
                    placeholder="Начните вводить название…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-1.5 block w-full min-w-[260px] max-w-md piton-input px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <p className="mt-1 text-xs piton-muted">
                Категория: {categoryLabel} · найдено:{" "}
                {filteredProducts.length}
                {reorderBusy ? " · сохранение порядка…" : ""}
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-lime-400/20 py-12 text-center text-sm piton-muted">
                {selectedCategory === ALL_PRODUCTS
                  ? "Ничего не найдено"
                  : `В категории «${selectedCategory}» ничего не найдено`}
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
                      draggable={!reorderBusy}
                      onDragStart={(e) => onCardDragStart(e, p.id)}
                      onDragEnd={onCardDragEnd}
                      onDragOver={(e) => onCardDragOver(e, p.id)}
                      onDrop={(e) => onCardDrop(e, p.id)}
                      className={`flex h-full min-h-[26rem] flex-col overflow-hidden piton-card cursor-grab active:cursor-grabbing ${
                        unavailable ? "opacity-70" : ""
                      } ${
                        dragId === p.id ? "opacity-50" : ""
                      } ${
                        dragOverId === p.id && dragId !== null && dragId !== p.id
                          ? "ring-2 ring-lime-400/60"
                          : ""
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={canAdd && draftOk && recipientOk ? 0 : -1}
                        aria-disabled={!canAdd || !draftOk || !recipientOk}
                        aria-label={`Добавить ${p.name} в корзину`}
                        onClick={() => {
                          if (canAdd && draftOk && recipientOk) addToCart(p);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          if (canAdd && draftOk && recipientOk) addToCart(p);
                        }}
                        className={`relative h-48 w-full shrink-0 overflow-hidden bg-[#071a0f] text-left transition hover:brightness-95 ${
                          !canAdd || !draftOk || !recipientOk
                            ? "cursor-grab"
                            : "cursor-grab"
                        }`}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            draggable={false}
                            className="pointer-events-none h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs piton-muted">
                            Нет фото
                          </div>
                        )}
                        {unavailable ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                            Нет в наличии
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <h2 className="line-clamp-2 text-sm font-semibold piton-title">
                          {p.name}
                        </h2>
                        <span className="w-fit piton-chip px-2 py-0.5 text-xs">
                          {p.category || "default"}
                        </span>
                        <div className="flex items-end justify-between gap-2 text-sm piton-label">
                          <span>{Number(p.price).toFixed(2)}</span>
                          <span className="tabular-nums">Склад: {p.stock}</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs piton-label">
                          <input
                            type="checkbox"
                            disabled={p.isPersonal || !canAdd}
                            checked={personalSelected}
                            onChange={(e) =>
                              setPersonal(p.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-lime-400/40 accent-lime-400 disabled:opacity-60"
                          />
                          <span>Персонал</span>
                          {p.isPersonal ? (
                            <span className="piton-chip px-2 py-0.5 text-[11px] font-medium">
                              обязательно
                            </span>
                          ) : null}
                        </label>
                        {inCart > 0 ? (
                          <p className="text-xs piton-muted">
                            Уже в корзине: {inCart} шт. · можно ещё: {maxAdd}
                          </p>
                        ) : null}
                        {personalSelected ? (
                          <label className="block text-xs piton-label">
                            Имя кто взял
                            <input
                              type="text"
                              disabled={!canAdd}
                              value={recipientFor(p.id)}
                              onChange={(e) =>
                                setRecipient(p.id, e.target.value)
                              }
                              className="mt-1 w-full piton-input px-2 py-1.5 text-sm"
                              placeholder="Например: Иван"
                            />
                          </label>
                        ) : null}
                        <label className="block text-xs piton-label">
                          Количество
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, maxAdd)}
                            disabled={!canAdd}
                            value={draft}
                            onChange={(e) => setDraftQty(p.id, e.target.value)}
                            className="mt-1 w-full piton-input px-2 py-1.5 text-sm tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          data-no-drag
                          disabled={!canAdd || !draftOk || !recipientOk}
                          onClick={() => addToCart(p)}
                          className="mt-auto w-full piton-btn w-full py-2 text-sm disabled:cursor-not-allowed"
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
