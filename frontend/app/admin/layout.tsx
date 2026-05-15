"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  TrendingUp,
  Users,
  ArrowLeft,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Пользователи", icon: Users, exact: false },
  { href: "/admin/funnel", label: "Воронка", icon: TrendingUp, exact: false },
  { href: "/admin/billing", label: "Тарифы и оплаты", icon: CreditCard, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex min-h-screen" style={{ background: "#0A0D12", color: "#E2E8F0" }}>
      {/* Sidebar */}
      <aside
        className="flex w-[220px] shrink-0 flex-col border-r"
        style={{ background: "#111318", borderColor: "#2E3347" }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-4 border-b" style={{ borderColor: "#2E3347" }}>
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "#219C46" }}>
            ДОЖИМ-АЙ
          </span>
          <span className="text-xs font-medium" style={{ color: "#64748B" }}>
            Admin
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
                className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: active ? "rgba(33,156,70,0.12)" : "transparent",
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

        {/* Back to app */}
        <div className="border-t p-3" style={{ borderColor: "#2E3347" }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:text-white"
            style={{ color: "#64748B" }}
          >
            <ArrowLeft size={13} />
            В кабинет
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header
          className="flex h-14 shrink-0 items-center justify-between border-b px-6"
          style={{ borderColor: "#2E3347", background: "#111318" }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "#64748B" }}>
            <BarChart3 size={14} />
            <span>Админ-панель · ДОЖИМ-АЙ</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
