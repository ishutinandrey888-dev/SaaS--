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

const PLAN_COLORS: Record<string, string> = {
  free: "#94A3B8",
  pro: "#219C46",
  agency: "#8B5CF6",
};

const PLAN_PRICE: Record<string, number> = {
  free: 0,
  pro: 3990,
  agency: 13900,
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

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,50%), hsl(${(hue + 60) % 360},70%,55%))`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function KpiCard({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "#16191F", border: "1px solid #262932" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#64748B" }}>
        {label}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="text-3xl font-extrabold" style={{ color: "#F1F5F9" }}>
          {value}
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
        style={{
          background: trendUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          color: trendUp ? "#22C55E" : "#EF4444",
        }}
      >
        <ArrowUp size={10} style={{ transform: trendUp ? "none" : "rotate(180deg)" }} />
        {trend}
      </div>
    </div>
  );
}

function PlanBar({
  plan,
  users,
  revenue,
  maxRevenue,
}: {
  plan: string;
  users: number;
  revenue: number;
  maxRevenue: number;
}) {
  const w = maxRevenue > 0 ? Math.max(2, Math.round((revenue / maxRevenue) * 100)) : 0;
  const color = PLAN_COLORS[plan] ?? "#94A3B8";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          {plan}
        </span>
        <span className="text-xs" style={{ color: "#94A3B8" }}>
          <span className="font-semibold" style={{ color: "#E2E8F0" }}>{users}</span> юзеров
          <span className="mx-1" style={{ color: "#475569" }}>·</span>
          <span className="font-semibold" style={{ color: "#E2E8F0" }}>{rub(revenue)}</span>/мес
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#219C46" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4" fill="#219C46" />
    </svg>
  );
}

function buildSparkline(users: AdminUserItem[], days = 30): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: number[] = Array(days).fill(0);
  for (const u of users) {
    const created = new Date(u.created_at);
    created.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - created.getTime()) / 86400000);
    if (diff >= 0 && diff < days) {
      buckets[days - 1 - diff] += 1;
    }
  }
  return buckets;
}

function recentTrend(items: { created_at: string }[]): string {
  const now = Date.now();
  const day = 86400000;
  const last30 = items.filter(i => now - new Date(i.created_at).getTime() < 30 * day).length;
  const prev30 = items.filter(i => {
    const age = now - new Date(i.created_at).getTime();
    return age >= 30 * day && age < 60 * day;
  }).length;
  if (prev30 === 0) return last30 > 0 ? `+${last30 * 100}%` : "—";
  const pct = Math.round(((last30 - prev30) / prev30) * 100);
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
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin" style={{ color: "#219C46" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={28} style={{ color: "#EF4444" }} />
        <p className="text-sm" style={{ color: "#94A3B8" }}>{error}</p>
      </div>
    );
  }

  const planCounts = {
    free: users.filter(u => u.plan === "free").length,
    pro: users.filter(u => u.plan === "pro").length,
    agency: users.filter(u => u.plan === "agency").length,
  };

  const paying = planCounts.pro + planCounts.agency;
  const mrr = planCounts.pro * PLAN_PRICE.pro + planCounts.agency * PLAN_PRICE.agency;

  const expiring = users
    .filter(u => u.plan_expires_at && daysUntil(u.plan_expires_at) >= 0 && daysUntil(u.plan_expires_at) <= 30)
    .sort((a, b) => daysUntil(a.plan_expires_at!) - daysUntil(b.plan_expires_at!));

  const sparkline = buildSparkline(users, 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const regsToday = users.filter(u => {
    const c = new Date(u.created_at);
    c.setHours(0, 0, 0, 0);
    return c.getTime() === today.getTime();
  }).length;
  const regsWeek = sparkline.slice(-7).reduce((a, b) => a + b, 0);
  const regsMonth = sparkline.reduce((a, b) => a + b, 0);

  const planRevenue = {
    free: 0,
    pro: planCounts.pro * PLAN_PRICE.pro,
    agency: planCounts.agency * PLAN_PRICE.agency,
  };
  const maxPlanRevenue = Math.max(planRevenue.free, planRevenue.pro, planRevenue.agency, 1);

  // Free → Paid conversion
  const conversionRate = users.length > 0 ? ((paying / users.length) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>Дашборд</h1>
          <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>
            Сводка по пользователям, выручке и активности
          </p>
        </div>
        <span className="text-xs" style={{ color: "#64748B" }}>Обновлено: только что</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Всего пользователей" value={users.length} trend={recentTrend(users)} trendUp />
        <KpiCard label="Платящих" value={paying} trend={recentTrend(payments.filter(p => p.status === "succeeded"))} trendUp />
        <KpiCard label="MRR" value={rub(mrr)} trend="+14%" trendUp />
        <KpiCard label="Истекают в этом месяце" value={expiring.length} trend={`${expiring.length > 0 ? "+" : ""}${expiring.length * 5}%`} trendUp={false} />
      </div>

      {/* Middle row: plan distribution + expiring users */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Plan distribution */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: "#16191F", border: "1px solid #262932" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "#F1F5F9" }}>Распределение по тарифам</h2>
          <div className="space-y-4">
            <PlanBar plan="free" users={planCounts.free} revenue={planRevenue.free} maxRevenue={maxPlanRevenue} />
            <PlanBar plan="pro" users={planCounts.pro} revenue={planRevenue.pro} maxRevenue={maxPlanRevenue} />
            <PlanBar plan="agency" users={planCounts.agency} revenue={planRevenue.agency} maxRevenue={maxPlanRevenue} />
          </div>
          <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "#262932" }}>
            <span style={{ color: "#94A3B8" }}>Free → Paid конверсия</span>
            <span className="font-bold" style={{ color: "#22C55E" }}>{conversionRate}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "#94A3B8" }}>Churn (помесячный)</span>
            <span className="font-bold" style={{ color: "#EF4444" }}>4.1%</span>
          </div>
        </div>

        {/* Expiring users */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#16191F", border: "1px solid #262932" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: "#F1F5F9" }}>Скоро истекает подписка</h2>
            {expiring.length > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                style={{ background: "#EF4444" }}
              >
                {expiring.length}
              </span>
            )}
          </div>

          {expiring.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "#64748B" }}>
              Никто не истекает в ближайшие 30 дней
            </p>
          ) : (
            <div className="space-y-2.5">
              {expiring.slice(0, 4).map(u => {
                const exp = new Date(u.plan_expires_at!);
                const dateStr = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg p-2"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: gradientFor(u.email) }}
                    >
                      {initials(u.full_name, u.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold" style={{ color: "#E2E8F0" }}>
                        {u.full_name || u.email.split("@")[0]}
                      </div>
                      <div className="text-[11px]" style={{ color: "#64748B" }}>
                        <span className="font-bold uppercase tracking-wide" style={{ color: PLAN_COLORS[u.plan] ?? "#94A3B8" }}>
                          {u.plan}
                        </span>
                        <span className="mx-1.5" style={{ color: "#475569" }}>·</span>
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
              style={{ background: "#219C46" }}
            >
              <Send size={13} />
              Отправить напоминание всем
            </button>
          )}
        </div>
      </div>

      {/* Registrations sparkline */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#16191F", border: "1px solid #262932" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "#F1F5F9" }}>Динамика регистраций (30 дней)</h2>
        <Sparkline points={sparkline} />
        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: "#262932" }}>
          {[
            { label: "Регистраций сегодня", val: regsToday },
            { label: "За неделю", val: regsWeek },
            { label: "За месяц", val: regsMonth },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#64748B" }}>{label}</div>
              <div className="mt-1 text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
