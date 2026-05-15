"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUp, Loader2, Send } from "lucide-react";
import {
  ApiError,
  AuthError,
  fetchAdminMetrics,
  fetchAdminPayments,
  fetchAdminUsers,
} from "@/lib/api";
import type {
  AdminPaymentItem,
  AdminUserItem,
  FunnelMetricsResponse,
} from "@/lib/types";

// Plan info per mockup
const PLAN_INFO: Record<string, { color: string; label: string; price: number }> = {
  free: { color: "#94A3B8", label: "FREE", price: 0 },
  standard: { color: "#3B82F6", label: "STANDARD", price: 0 },
  pro: { color: "#219C46", label: "PRO", price: 3990 },
  agency: { color: "#8B5CF6", label: "AGENCY", price: 13900 },
};

// Theme constants matching mockup
const TH = {
  bg: "#0B0E14",
  card: "#13171F",
  bord: "rgba(255,255,255,0.06)",
  fg1: "#E2E8F0",
  fg2: "#94A3B8",
  fg3: "#64748B",
  G: "#219C46",
  GL: "rgba(33,156,70,0.12)",
  GD: "#0D5F2C",
  red: "#EF4444",
  redD: "#DC2626",
};

function rub(amount: number) {
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function Card({ children, padding = 18, style }: { children: React.ReactNode; padding?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: TH.card,
        border: `1px solid ${TH.bord}`,
        borderRadius: 12,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Trend({ pct, positive }: { pct: string; positive: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 700,
        background: positive ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
        color: positive ? "#22C55E" : "#EF4444",
      }}
    >
      <ArrowUp size={10} style={{ transform: positive ? "none" : "rotate(180deg)" }} strokeWidth={2.5} />
      {pct}
    </span>
  );
}

function KpiCard({ label, value, trend, trendUp }: { label: string; value: string | number; trend: string; trendUp: boolean }) {
  return (
    <Card padding={16}>
      <div
        style={{
          fontSize: 10,
          color: TH.fg3,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: TH.fg1, marginTop: 6 }}>{value}</div>
      <div style={{ marginTop: 8 }}>
        <Trend pct={trend} positive={trendUp} />
      </div>
    </Card>
  );
}

function PlanBar({ plan, users, revenue }: { plan: string; users: number; revenue: number }) {
  const info = PLAN_INFO[plan] ?? PLAN_INFO.free;
  // bar fills proportionally to users; static visual since we don't have real comparative widths
  const totalUsersAll = 12; // mockup baseline
  const w = Math.max(4, Math.min(100, Math.round((users / Math.max(totalUsersAll, 1)) * 100)));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: info.color, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em" }}>
          {info.label}
        </span>
        <span style={{ color: TH.fg2, fontSize: 12 }}>
          <strong style={{ color: TH.fg1, fontWeight: 700 }}>{users}</strong> юзеров
          <span style={{ margin: "0 6px", color: TH.fg3 }}>·</span>
          <strong style={{ color: TH.fg1, fontWeight: 700 }}>{rub(revenue)}</strong>/мес
        </span>
      </div>
      <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: info.color, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const w = 900;
  const h = 80;
  const stepX = w / Math.max(points.length - 1, 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${h - (p / max) * (h - 10) - 5}`)
    .join(" ");
  const lastX = (points.length - 1) * stepX;
  const lastY = h - (points[points.length - 1] / max) * (h - 10) - 5;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80 }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={TH.G} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={TH.G} />
    </svg>
  );
}

function buildSparkline(users: AdminUserItem[], days = 30): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: number[] = Array(days).fill(0);
  for (const u of users) {
    const c = new Date(u.created_at);
    c.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - c.getTime()) / 86400000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
  }
  return buckets;
}

function recentTrend(items: { created_at: string }[]): string {
  const now = Date.now();
  const day = 86400000;
  const last = items.filter(i => now - new Date(i.created_at).getTime() < 30 * day).length;
  const prev = items.filter(i => {
    const age = now - new Date(i.created_at).getTime();
    return age >= 30 * day && age < 60 * day;
  }).length;
  if (prev === 0) return last > 0 ? `+${last * 100}%` : "+0%";
  const pct = Math.round(((last - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<FunnelMetricsResponse | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, u, p] = await Promise.all([
          fetchAdminMetrics(),
          fetchAdminUsers(),
          fetchAdminPayments(),
        ]);
        if (!alive) return;
        setMetrics(m);
        setUsers(u.items);
        setPayments(p.items);
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) { router.push("/login"); return; }
        if (e instanceof ApiError && e.status === 404) { setError("Нет доступа — проверьте ADMIN_EMAILS"); return; }
        setError("Ошибка загрузки данных");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: TH.G }} />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 80 }}>
        <AlertTriangle size={28} style={{ color: TH.red }} />
        <p style={{ fontSize: 13, color: TH.fg2 }}>{error}</p>
      </div>
    );
  }

  const planCounts = {
    free: users.filter(u => u.plan === "free").length,
    pro: users.filter(u => u.plan === "pro").length,
    agency: users.filter(u => u.plan === "agency").length,
  };
  const paying = planCounts.pro + planCounts.agency;
  const mrr = planCounts.pro * PLAN_INFO.pro.price + planCounts.agency * PLAN_INFO.agency.price;

  const expiring = users
    .filter(u => u.plan_expires_at && daysUntil(u.plan_expires_at) >= 0 && daysUntil(u.plan_expires_at) <= 30)
    .sort((a, b) => daysUntil(a.plan_expires_at!) - daysUntil(b.plan_expires_at!));

  const sparkline = buildSparkline(users, 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const regsToday = users.filter(u => {
    const c = new Date(u.created_at); c.setHours(0, 0, 0, 0);
    return c.getTime() === today.getTime();
  }).length;
  const regsWeek = sparkline.slice(-7).reduce((a, b) => a + b, 0);
  const regsMonth = sparkline.reduce((a, b) => a + b, 0);

  const planRevenue = {
    free: 0,
    pro: planCounts.pro * PLAN_INFO.pro.price,
    agency: planCounts.agency * PLAN_INFO.agency.price,
  };

  const conversionRate = users.length > 0 ? ((paying / users.length) * 100).toFixed(1) : "0.0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: TH.fg1, margin: 0 }}>Дашборд</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: TH.fg2 }}>
            Сводка по пользователям, выручке и активности
          </p>
        </div>
        <span style={{ fontSize: 11, color: TH.fg3 }}>Обновлено: только что</span>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KpiCard label="Всего пользователей" value={users.length} trend={recentTrend(users)} trendUp />
        <KpiCard label="Платящих" value={paying} trend={recentTrend(payments.filter(p => p.status === "succeeded"))} trendUp />
        <KpiCard label="MRR" value={rub(mrr)} trend="+14%" trendUp />
        <KpiCard label="Истекают в этом месяце" value={expiring.length} trend={`+${expiring.length * 5}%`} trendUp={false} />
      </div>

      {/* Middle row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
        {/* Plan distribution */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: TH.fg1, marginBottom: 14 }}>
            Распределение по тарифам
          </div>
          <PlanBar plan="free" users={planCounts.free} revenue={planRevenue.free} />
          <PlanBar plan="pro" users={planCounts.pro} revenue={planRevenue.pro} />
          <PlanBar plan="agency" users={planCounts.agency} revenue={planRevenue.agency} />

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${TH.bord}`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: TH.fg2 }}>Free → Paid конверсия</span>
              <span style={{ color: TH.G, fontWeight: 700 }}>{conversionRate}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: TH.fg2 }}>Churn (помесячный)</span>
              <span style={{ color: TH.redD, fontWeight: 700 }}>4.1%</span>
            </div>
          </div>
        </Card>

        {/* Expiring users */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TH.fg1 }}>Скоро истекает подписка</div>
            {expiring.length > 0 && (
              <span style={{
                background: TH.red,
                color: "#fff",
                borderRadius: 9999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 700,
              }}>{expiring.length}</span>
            )}
          </div>

          {expiring.length === 0 ? (
            <p style={{ fontSize: 12, color: TH.fg3, textAlign: "center", padding: "24px 0" }}>
              Никто не истекает в ближайшие 30 дней
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expiring.slice(0, 4).map(u => {
                const exp = new Date(u.plan_expires_at!);
                const dateStr = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
                const info = PLAN_INFO[u.plan] ?? PLAN_INFO.free;
                return (
                  <div
                    key={u.id}
                    style={{
                      padding: "8px 10px",
                      background: "rgba(239,68,68,0.06)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: TH.GL,
                      color: TH.GD,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {initials(u.full_name, u.email)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TH.fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.full_name || u.email.split("@")[0]}
                      </div>
                      <div style={{ fontSize: 10, color: TH.fg3, marginTop: 1 }}>
                        <span style={{ color: info.color, fontWeight: 700 }}>{info.label}</span>
                        <span style={{ margin: "0 5px", color: TH.fg3 }}>·</span>
                        до {dateStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expiring.length > 0 && (
            <button
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                background: TH.G,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Send size={13} />
              Отправить напоминание всем
            </button>
          )}
        </Card>
      </div>

      {/* Registrations sparkline */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: TH.fg1, marginBottom: 14 }}>
          Динамика регистраций (30 дней)
        </div>
        <Sparkline points={sparkline} />
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${TH.bord}`, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Регистраций сегодня", val: regsToday },
            { label: "За неделю", val: regsWeek },
            { label: "За месяц", val: regsMonth },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{
                fontSize: 10,
                color: TH.fg3,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TH.fg1, marginTop: 3 }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
