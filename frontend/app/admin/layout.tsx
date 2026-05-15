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
    <div
      className="flex min-h-screen"
      style={{
        background: "#1A1D2E",
        color: "#E2E8F0",
        fontFamily: "'Montserrat', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        className="flex w-[220px] shrink-0 flex-col border-r"
        style={{ background: "#13171F", borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Logo header */}
        <div className="flex flex-col gap-0.5 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span
            style={{
              color: "#219C46",
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "0.06em",
            }}
          >
            ДОЖИМ-АЙ
          </span>
          <span
            style={{
              color: "#64748B",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: 2,
            }}
          >
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
                className="flex items-center transition-colors"
                style={{
                  margin: "2px 8px",
                  padding: "9px 10px",
                  gap: 10,
                  borderRadius: 8,
                  fontSize: 12,
                  background: active ? "rgba(33,156,70,0.12)" : "transparent",
                  color: active ? "#219C46" : "#94A3B8",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — back to cabinet */}
        <div className="p-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Link
            href="/dashboard"
            className="flex items-center transition-colors hover:bg-white/[0.04]"
            style={{
              padding: "9px 10px",
              gap: 10,
              borderRadius: 8,
              fontSize: 12,
              color: "#94A3B8",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} />
            Вернуться в кабинет
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header
          className="flex shrink-0 items-center justify-between border-b"
          style={{
            height: 50,
            padding: "0 20px",
            borderColor: "rgba(255,255,255,0.06)",
            background: "#13171F",
          }}
        >
          <div className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>
            <span>Админ-панель</span>
            <span style={{ color: "#64748B", fontWeight: 400 }}>·</span>
            <span style={{ color: "#64748B", fontWeight: 500 }}>SaaS</span>
          </div>

          <div className="flex items-center gap-3">
            {me && (
              <>
                <span style={{ fontSize: 11, color: "#64748B" }}>{me.email}</span>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "rgba(33,156,70,0.18)",
                    color: "#0D5F2C",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {avatarFromEmail(me.email)}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center transition-colors hover:bg-white/[0.04]"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9999,
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#94A3B8",
                  }}
                  title="Выйти"
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: "20px" }}>{children}</main>
      </div>
    </div>
  );
}
