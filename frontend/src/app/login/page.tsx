"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 font-semibold text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
            PB
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Play Beta</h1>
            <p className="mt-1 text-sm text-cyan-100/70">
              Вход в учёт склада компьютерного клуба
            </p>
          </div>
        </div>
        {err ? (
          <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {err}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-cyan-100/75">Логин</span>
            <input
              required
              autoComplete="username"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-cyan-100/75">Пароль</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-cyan-300 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-200 disabled:opacity-50"
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
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Загрузка…</p>}>
      <LoginForm />
    </Suspense>
  );
}
