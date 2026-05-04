"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiDelete,
  apiGet,
  apiPatchForm,
  apiPostJson,
  apiPostForm,
  assetUrl,
} from "@/lib/api";

type Category = {
  id: number;
  name: string;
};

type CurrentUser = {
  login: string;
  role: string;
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

function emptyForm() {
  return {
    name: "",
    price: "",
    stock: "",
    category: "default",
    isPersonal: false,
    file: null as File | null,
  };
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const [create, setCreate] = useState(emptyForm);
  /** Сброс отображения «выбранного файла» в input type=file после сохранения */
  const [createFileInputKey, setCreateFileInputKey] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState(emptyForm);
  const [editFileInputKey, setEditFileInputKey] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<Product[]>("/products");
      setItems(data);
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
      const data = await apiGet<Category[]>("/categories");
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки категорий");
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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

  const messageClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messageClearRef.current) {
      clearTimeout(messageClearRef.current);
      messageClearRef.current = null;
    }
    if (!message) return;
    messageClearRef.current = setTimeout(() => {
      setMessage(null);
      messageClearRef.current = null;
    }, 4000);
    return () => {
      if (messageClearRef.current) clearTimeout(messageClearRef.current);
    };
  }, [message]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.append("name", create.name.trim());
    fd.append("price", String(Number(create.price)));
    fd.append("stock", String(Number(create.stock)));
    fd.append("category", create.category.trim() || "default");
    fd.append("isPersonal", String(create.isPersonal));
    if (create.file) fd.append("image", create.file);
    try {
      await apiPostForm<Product>("/products", fd);
      setCreate(emptyForm());
      setCreateFileInputKey((k) => k + 1);
      setMessage("Товар добавлен");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    setEdit({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      category: p.category || "default",
      isPersonal: p.isPersonal,
      file: null,
    });
    setMessage(null);
    setError(null);
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (editId == null) return;
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.append("name", edit.name.trim());
    fd.append("price", String(Number(edit.price)));
    fd.append("stock", String(Number(edit.stock)));
    fd.append("category", edit.category.trim() || "default");
    fd.append("isPersonal", String(edit.isPersonal));
    if (edit.file) fd.append("image", edit.file);
    try {
      await apiPatchForm<Product>(`/products/${editId}`, fd);
      setEditId(null);
      setEdit(emptyForm());
      setEditFileInputKey((k) => k + 1);
      setMessage("Товар обновлён");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Удалить товар?")) return;
    setMessage(null);
    setError(null);
    try {
      await apiDelete(`/products/${id}`);
      if (editId === id) {
        setEditId(null);
        setEdit(emptyForm());
      }
      setMessage("Товар удалён");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  }

  async function onCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiPostJson<Category>("/categories", { name: newCategory.trim() });
      setNewCategory("");
      setMessage("Категория добавлена");
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось добавить категорию",
      );
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Товары
        </h1>
        <p className="mt-2 text-sm text-cyan-100/70">
          Добавление, редактирование и удаление. Цена и остаток — числа.
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

      {currentUser?.login === "admin2026" ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Категории
          </h2>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={onCreateCategory}
          >
            <label className="block min-w-[220px] text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Новая категория
              </span>
              <input
                required
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Например: snacks"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              Добавить категорию
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {c.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Новый товар
        </h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Название</span>
            <input
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={create.name}
              onChange={(e) =>
                setCreate((s) => ({ ...s, name: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Цена</span>
            <input
              required
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={create.price}
              onChange={(e) =>
                setCreate((s) => ({ ...s, price: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Остаток</span>
            <input
              required
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={create.stock}
              onChange={(e) =>
                setCreate((s) => ({ ...s, stock: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Категория</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={create.category}
              onChange={(e) =>
                setCreate((s) => ({ ...s, category: e.target.value }))
              }
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Картинка</span>
            <input
              key={createFileInputKey}
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) =>
                setCreate((s) => ({
                  ...s,
                  file: e.target.files?.[0] ?? null,
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300"
              checked={create.isPersonal}
              onChange={(e) =>
                setCreate((s) => ({ ...s, isPersonal: e.target.checked }))
              }
            />
            <span className="text-zinc-600 dark:text-zinc-400">Персоналка</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Сохранить
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Список
          </h2>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Пока нет товаров.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Фото</th>
                  <th className="px-4 py-2 font-medium">Название</th>
                  <th className="px-4 py-2 font-medium">Категория</th>
                  <th className="px-4 py-2 font-medium">Цена</th>
                  <th className="px-4 py-2 font-medium">Остаток</th>
                  <th className="px-4 py-2 font-medium">Персоналка</th>
                  <th className="px-4 py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-2">
                      {assetUrl(p.imageUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetUrl(p.imageUrl)!}
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                        {p.category || "default"}
                      </span>
                    </td>
                    <td className="px-4 py-2">{Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-2">{p.stock}</td>
                    <td className="px-4 py-2">
                      {p.isPersonal ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          Да
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
                          onClick={() => startEdit(p)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                          onClick={() => void onDelete(p.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editId != null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-product-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Закрыть редактирование"
            onClick={() => {
              setEditId(null);
              setEdit(emptyForm());
            }}
          />
          <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-300/20 bg-white p-4 shadow-2xl shadow-cyan-950/30 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="edit-product-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Редактирование товара #{editId}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Измените данные товара и сохраните результат.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => {
                  setEditId(null);
                  setEdit(emptyForm());
                }}
              >
                Закрыть
              </button>
            </div>
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2"
              onSubmit={onUpdate}
            >
              <label className="block text-sm sm:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Название
                </span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={edit.name}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Цена</span>
                <input
                  required
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={edit.price}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, price: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Остаток
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={edit.stock}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, stock: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Категория
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={edit.category}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, category: e.target.value }))
                  }
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Новая картинка (необязательно)
                </span>
                <input
                  key={`${editId}-${editFileInputKey}`}
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(e) =>
                    setEdit((s) => ({
                      ...s,
                      file: e.target.files?.[0] ?? null,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={edit.isPersonal}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, isPersonal: e.target.checked }))
                  }
                />
                <span className="text-zinc-600 dark:text-zinc-400">
                  Персоналка
                </span>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Сохранить изменения
                </button>
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                  onClick={() => {
                    setEditId(null);
                    setEdit(emptyForm());
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
