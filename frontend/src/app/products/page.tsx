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
        <h1 className="font-display text-3xl font-semibold tracking-tight piton-title">
          Товары
        </h1>
        <p className="mt-2 text-sm piton-muted">
          Добавление, редактирование и удаление. Цена и остаток — числа.
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

      {currentUser?.login === "admin2026" ? (
        <section className="piton-card p-4">
          <h2 className="text-sm font-medium piton-title">
            Категории
          </h2>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={onCreateCategory}
          >
            <label className="block min-w-[220px] text-sm">
              <span className="piton-label">
                Новая категория
              </span>
              <input
                required
                className="mt-1 w-full piton-input px-3 py-2 text-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Например: snacks"
              />
            </label>
            <button
              type="submit"
              className="piton-btn px-4 py-2 text-sm"
            >
              Добавить категорию
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="piton-chip px-3 py-1 text-xs"
              >
                {c.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="piton-card p-4">
        <h2 className="text-sm font-medium piton-title">
          Новый товар
        </h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="block text-sm">
            <span className="piton-label">Название</span>
            <input
              required
              className="mt-1 w-full piton-input px-3 py-2 text-sm"
              value={create.name}
              onChange={(e) =>
                setCreate((s) => ({ ...s, name: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="piton-label">Цена</span>
            <input
              required
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full piton-input px-3 py-2 text-sm"
              value={create.price}
              onChange={(e) =>
                setCreate((s) => ({ ...s, price: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="piton-label">Остаток</span>
            <input
              required
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full piton-input px-3 py-2 text-sm"
              value={create.stock}
              onChange={(e) =>
                setCreate((s) => ({ ...s, stock: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="piton-label">Категория</span>
            <select
              className="mt-1 w-full piton-input px-3 py-2 text-sm"
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
            <span className="piton-label">Картинка</span>
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
              className="h-4 w-4 rounded border-lime-400/40 accent-lime-400"
              checked={create.isPersonal}
              onChange={(e) =>
                setCreate((s) => ({ ...s, isPersonal: e.target.checked }))
              }
            />
            <span className="piton-label">Персоналка</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="piton-btn px-4 py-2 text-sm"
            >
              Сохранить
            </button>
          </div>
        </form>
      </section>

      <section className="piton-card">
        <div className="border-b border-lime-400/15 px-4 py-3">
          <h2 className="text-sm font-medium piton-title">
            Список
          </h2>
        </div>
        {loading ? (
          <p className="p-4 text-sm piton-muted">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm piton-muted">Пока нет товаров.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-lime-400/5 piton-table-head">
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
                    className="piton-row"
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
                        <span className="piton-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium piton-title">
                      {p.name}
                    </td>
                    <td className="px-4 py-2">
                      <span className="piton-chip px-2 py-0.5 text-xs">
                        {p.category || "default"}
                      </span>
                    </td>
                    <td className="px-4 py-2 piton-label">
                      {Number(p.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 piton-label">{p.stock}</td>
                    <td className="px-4 py-2">
                      {p.isPersonal ? (
                        <span className="piton-chip px-2 py-0.5 text-xs">
                          Да
                        </span>
                      ) : (
                        <span className="piton-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="piton-btn-ghost px-2 py-1 text-xs"
                          onClick={() => startEdit(p)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="piton-btn-danger px-2 py-1 text-xs"
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
            className="absolute inset-0 bg-[#04150c]/75 backdrop-blur-sm"
            aria-label="Закрыть редактирование"
            onClick={() => {
              setEditId(null);
              setEdit(emptyForm());
            }}
          />
          <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto piton-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="edit-product-title"
                  className="text-base font-semibold piton-title"
                >
                  Редактирование товара #{editId}
                </h2>
                <p className="mt-1 text-xs piton-muted">
                  Измените данные товара и сохраните результат.
                </p>
              </div>
              <button
                type="button"
                className="piton-btn-ghost px-2 py-1 text-sm"
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
                <span className="piton-label">
                  Название
                </span>
                <input
                  required
                  className="mt-1 w-full piton-input px-3 py-2 text-sm"
                  value={edit.name}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="piton-label">Цена</span>
                <input
                  required
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full piton-input px-3 py-2 text-sm"
                  value={edit.price}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, price: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="piton-label">
                  Остаток
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1 w-full piton-input px-3 py-2 text-sm"
                  value={edit.stock}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, stock: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="piton-label">
                  Категория
                </span>
                <select
                  className="mt-1 w-full piton-input px-3 py-2 text-sm"
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
                <span className="piton-label">
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
                  className="h-4 w-4 rounded border-lime-400/40 accent-lime-400"
                  checked={edit.isPersonal}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, isPersonal: e.target.checked }))
                  }
                />
                <span className="piton-label">
                  Персоналка
                </span>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="piton-btn px-4 py-2 text-sm"
                >
                  Сохранить изменения
                </button>
                <button
                  type="button"
                  className="piton-btn-ghost px-4 py-2 text-sm"
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
