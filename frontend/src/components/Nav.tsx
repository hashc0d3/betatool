"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";

const links = [
  { href: "/products", label: "Товары" },
  { href: "/reports", label: "Отчёты" },
  { href: "/sale", label: "Продажа" },
] as const;

type CurrentUser = {
  login: string;
  role: string;
};

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const visibleLinks = links.filter(
    (link) => link.href !== "/reports" || currentUser?.login === "admin2026",
  );

  useEffect(() => {
    if (pathname === "/login") return;
    async function loadCurrentUser() {
      try {
        const user = await apiGet<CurrentUser>("/auth/me");
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      }
    }
    void loadCurrentUser();
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  async function logout() {
    try {
      await apiPostJson("/auth/logout", {});
    } catch {
      /* ignore */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-400/20 bg-slate-950/85 shadow-[0_12px_40px_rgba(8,47,73,0.28)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/products"
          className="group flex items-center gap-3 text-sm font-semibold tracking-tight text-white"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-base text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
            PB
          </span>
          <span className="min-w-0">
            <span className="block text-base leading-tight">Play Beta</span>
            <span className="block text-xs font-normal text-cyan-100/70">
              учёт склада компьютерного клуба
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-inner shadow-black/20">
            {visibleLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                      : "text-cyan-50/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {currentUser ? (
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-50 shadow-[0_0_22px_rgba(16,185,129,0.18)]">
              <span className="text-emerald-100/70">Учётка:</span>{" "}
              <span className="font-semibold">{currentUser.login}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-cyan-50/80 transition hover:border-red-300/40 hover:bg-red-400/10 hover:text-white"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
