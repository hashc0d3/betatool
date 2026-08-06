"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { SnakeLogo } from "./SnakeLogo";

const links = [
  { href: "/products", label: "Товары" },
  { href: "/reports", label: "Отчёты" },
  { href: "/sale", label: "Продажа" },
  { href: "/deferred", label: "Отложенные" },
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
    <header className="sticky top-0 z-30 border-b border-lime-400/15 bg-[#04150c]/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/products"
          className="group flex items-center gap-3 text-sm font-semibold tracking-tight"
        >
          <span className="piton-logo-glow shrink-0">
            <SnakeLogo className="h-10 w-10" />
          </span>
          <span className="min-w-0">
            <span className="font-display block text-lg leading-tight tracking-[0.14em] text-lime-200">
              ПИТОН
            </span>
            <span className="block text-xs font-normal piton-muted">
              ПК-клуб · учёт склада
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-1 rounded-2xl border border-lime-400/15 bg-lime-400/5 p-1">
            {visibleLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "piton-nav-active"
                      : "text-lime-100/70 hover:bg-lime-400/10 hover:text-lime-50"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {currentUser ? (
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-xs text-lime-50">
              <span className="piton-muted">Учётка:</span>{" "}
              <span className="font-semibold">{currentUser.login}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="piton-btn-ghost px-3 py-2 text-sm"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
