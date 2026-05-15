"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Globe,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { fetchMe, logout } from "@/lib/api";
import type { Me } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Пользователи", icon: Users, exact: false },
  { href: "/admin/employees", label: "Сотрудники", icon: UserPlus, exact: false },
  { href: "/admin/funnel", label: "Воронка", icon: TrendingUp, exact: false },
  { href: "/admin/sources", label: "Источники", icon: Globe, exact: false },
  { href: "/admin/utm", label: "UTM-метки", icon: Link2, exact: false },
  { href: "/admin/broadcasts", label: "Рассылки", icon: Megaphone, exact: false },
  { href: "/admin/billing", label: "Тарифы и оплаты", icon: CreditCard, exact: false },
];

function avatarFromEmail(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#0F1115", color: "#E2E8F0" }}>
      {/* Sidebar */}
      <aside
        className="flex w-[220px] shrink-0 flex-col border-r"
        style={{ background: "#16191F", borderColor: "#262932" }}
      >
        {/* Logo header */}
        <div className="flex flex-col gap-0.5 px-5 py-4 border-b" style={{ borderColor: "#262932" }}>
          <span className="text-base font-black tracking-widest uppercase" style={{ color: "#219C46", letterSpacing: "0.08em" }}>
            ДОЖИМ-АЙ
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#64748B", letterSpacing: "0.15em" }}>
            Admin Panel
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-xs transition-colors"
                style={{
                  background: active ? "rgba(33,156,70,0.14)" : "transparent",
                  color: active ? "#219C46" : "#94A3B8",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — back to cabinet */}
        <div className="p-3 border-t" style={{ borderColor: "#262932" }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/[0.04]"
            style={{ color: "#94A3B8" }}
          >
            <ArrowLeft size={13} />
            Вернуться в кабинет
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header
          className="flex h-14 shrink-0 items-center justify-between border-b px-6"
          style={{ borderColor: "#262932", background: "#16191F" }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94A3B8" }}>
            <span>Админ-панель</span>
            <span style={{ color: "#475569" }}>·</span>
            <span>SaaS</span>
          </div>

          <div className="flex items-center gap-3">
            {me && (
              <>
                <span className="text-xs font-medium" style={{ color: "#E2E8F0" }}>
                  {me.email}
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "#219C46", color: "#fff" }}
                >
                  {avatarFromEmail(me.email)}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.05]"
                  style={{ color: "#94A3B8", border: "1px solid #262932" }}
                  title="Выйти"
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
