"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SnakeLogo } from "@/components/SnakeLogo";
import { apiPostJson } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiPostJson("/auth/login", { login, password });
      const to = search.get("from") || "/products";
      router.replace(to.startsWith("/") ? to : "/products");
      router.refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <div className="piton-card p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="piton-logo-glow shrink-0">
            <SnakeLogo className="h-14 w-14" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[0.14em] text-lime-200">
              ПИТОН
            </h1>
            <p className="mt-1 text-sm piton-muted">
              Вход в учёт склада ПК-клуба
            </p>
          </div>
        </div>
        {err ? <p className="piton-err px-3 py-2 text-sm">{err}</p> : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="piton-label">Логин</span>
            <input
              required
              autoComplete="username"
              className="mt-1.5 w-full piton-input px-3 py-2.5 text-sm"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="piton-label">Пароль</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              className="mt-1.5 w-full piton-input px-3 py-2.5 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="piton-btn w-full py-3 text-sm"
          >
            {busy ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm piton-muted">Загрузка…</p>}>
      <LoginForm />
    </Suspense>
  );
}
