"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Cog,
  Home,
  LifeBuoy,
  LineChart,
  ListChecks,
  LogOut,
  Megaphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { ApiError, AuthError, fetchMe, logout } from "@/lib/api";
import type { Me } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/analyst", label: "AI-аналитик", icon: Bot },
  { href: "/yandex", label: "Яндекс Директ", icon: Megaphone },
  { href: "/opportunities", label: "Возможности", icon: Sparkles },
  { href: "/history", label: "История", icon: ListChecks },
  { href: "/analytics", label: "Аналитика", icon: LineChart },
  { href: "/settings", label: "Настройки", icon: Cog },
  { href: "/help", label: "Центр помощи", icon: LifeBuoy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await fetchMe();
        if (!cancelled) setMe(u);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        if (e instanceof ApiError) setError(e.message);
        else setError("Не удалось загрузить профиль.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    router.push("/login");
  };

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-ink-300/40 bg-ink-50 px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
            <Activity className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            ДОЖИМ-АЙ
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-ink-200 text-ink-900"
                    : "text-ink-600 hover:bg-ink-200/60 hover:text-ink-900")
                }
              >
                <Icon
                  className={
                    "h-4 w-4 " +
                    (active ? "text-brand-500" : "text-ink-500")
                  }
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-300/40 pt-4">
          {me ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-ink-200/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink-900">
                  {me.full_name || me.email}
                </p>
                <p className="truncate text-[11px] uppercase tracking-wide text-ink-600">
                  {me.plan}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-300 hover:text-ink-900"
                title="Выйти"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : error ? (
            <p className="px-3 text-xs text-rose-400">{error}</p>
          ) : (
            <p className="px-3 text-xs text-ink-600">Загрузка…</p>
          )}
          <Link
            href="/settings"
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-600 hover:bg-ink-200/60 hover:text-ink-900"
          >
            <Wallet className="h-3.5 w-3.5" />
            Тариф и оплата
          </Link>
        </div>
      </aside>

      <main className="min-h-screen overflow-x-hidden">{children}</main>
    </div>
  );
}
