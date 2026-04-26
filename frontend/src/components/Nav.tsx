"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPostJson } from "@/lib/api";

const links = [
  { href: "/products", label: "Товары" },
  { href: "/reports", label: "Отчёты" },
  { href: "/sale", label: "Продажа" },
] as const;

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();

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
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/products"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Склад клуба
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
