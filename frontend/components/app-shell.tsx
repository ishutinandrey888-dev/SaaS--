"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart2,
  Bot,
  ChevronDown,
  CircleHelp,
  Clock,
  Cog,
  Home,
  LogOut,
  Megaphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ApiError, AuthError, fetchMe, logout } from "@/lib/api";
import type { Me } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeRed?: boolean;
}

function NavIcon({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 6, background: bg,
      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ color, display: "flex" }}>{children}</span>
    </span>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard", label: "Главная",
    icon: <NavIcon bg="#1E4D35" color="#4ADE80"><Home size={13} /></NavIcon>,
  },
  {
    href: "/analyst", label: "AI-аналитик",
    icon: <NavIcon bg="#3B2F6E" color="#A78BFA"><Bot size={13} /></NavIcon>,
    badge: 0,
  },
  {
    href: "/yandex", label: "Яндекс Директ",
    icon: <NavIcon bg="#1C2A4A" color="#60A5FA"><Megaphone size={13} /></NavIcon>,
  },
  {
    href: "/opportunities", label: "Возможности",
    icon: <NavIcon bg="#3B2A10" color="#FBBF24"><Sparkles size={13} /></NavIcon>,
  },
  {
    href: "/analytics", label: "Аналитика",
    icon: <NavIcon bg="#1C2E4A" color="#38BDF8"><BarChart2 size={13} /></NavIcon>,
  },
  {
    href: "/history", label: "История",
    icon: <span style={{ display: "flex", color: "#64748b" }}><Clock size={18} /></span>,
  },
  {
    href: "/settings", label: "Настройки",
    icon: <span style={{ display: "flex", color: "#64748b" }}><Cog size={18} /></span>,
  },
  {
    href: "/help", label: "Центр помощи",
    icon: <span style={{ display: "flex", color: "#64748b" }}><CircleHelp size={18} /></span>,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await fetchMe();
        if (!cancelled) setMe(u);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) { router.push("/login"); return; }
        if (e instanceof ApiError) setError(e.message);
        else setError("Не удалось загрузить профиль.");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    router.push("/login");
  };

  const displayName = me?.full_name || me?.email?.split("@")[0] || "Пользователь";
  const initials = displayName.split(/[ .]/).filter(Boolean).slice(0, 2).map((s: string) => s[0] || "").join("").toUpperCase() || "П";
  const plan = me?.plan || "free";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#1A1D2E" }}>
      {/* Sidebar */}
      <aside style={{
        width: 210, flexShrink: 0,
        background: "#232638",
        borderRight: "1px solid #2E3347",
        display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0,
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #2E3347",
          display: "flex", alignItems: "center", minHeight: 56,
        }}>
          <BrandLogo href="/dashboard" width={160} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 6, overflowY: "auto" }}>
          {NAV_ITEMS.map(({ href, label, icon, badge, badgeRed }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8, marginBottom: 1,
                  cursor: "pointer", fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  background: active ? "rgba(33,156,70,0.12)" : "transparent",
                  color: active ? "#4ADE80" : "#94A3B8",
                  textDecoration: "none",
                  transition: "background 120ms",
                }}
              >
                <span style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge != null && badge > 0 && (
                  <span style={{
                    background: badgeRed ? "#EF4444" : "#4ADE80",
                    color: "#fff", borderRadius: 9999,
                    padding: "1px 6px", fontSize: 10, fontWeight: 700,
                  }}>{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #2E3347", position: "relative" }}>
          {/* Popover menu */}
          {menuOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% - 6px)", left: 8, right: 8,
              background: "#232638", border: "1px solid #2E3347", borderRadius: 9,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", zIndex: 10,
            }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #2E3347" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me?.email || ""}</div>
              </div>
              <Link href="/settings" onClick={() => setMenuOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", fontSize: 12, color: "#94A3B8", textDecoration: "none", cursor: "pointer",
              }}>
                <Cog size={12} />Настройки
              </Link>
              <Link href="/billing" onClick={() => setMenuOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", fontSize: 12, color: "#94A3B8", textDecoration: "none", cursor: "pointer",
              }}>
                <Wallet size={12} />Тариф и оплата
              </Link>
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                style={{
                  display: "flex", width: "100%", alignItems: "center", gap: 8,
                  padding: "9px 12px", fontSize: 12, color: "#F87171", cursor: "pointer",
                  background: "none", border: "none",
                  borderTop: "1px solid #2E3347",
                }}
              >
                <LogOut size={12} />Выйти
              </button>
            </div>
          )}

          {/* User row */}
          {error ? (
            <p style={{ fontSize: 11, color: "#F87171", padding: "2px 0" }}>{error}</p>
          ) : (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                cursor: "pointer", padding: "2px 0", width: "100%",
                background: "none", border: "none",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #219C46, #27b350)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>{initials}</div>
              <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me ? displayName : "Загрузка…"}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8" }}>{plan.toUpperCase()}</div>
              </div>
              <ChevronDown size={12} color="#475569" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minHeight: "100vh", overflow: "hidden auto", background: "#1A1D2E" }}>
        {children}
      </main>
    </div>
  );
}
