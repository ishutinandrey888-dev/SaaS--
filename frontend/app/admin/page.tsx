"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, CreditCard, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { ApiError, AuthError, fetchAdminMetrics, fetchAdminUsers } from "@/lib/api";
import type { FunnelMetricsResponse, AdminUsersResponse } from "@/lib/types";

const PLAN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  free: { bg: "rgba(148,163,184,0.12)", text: "#94A3B8", label: "FREE" },
  pro: { bg: "rgba(33,156,70,0.12)", text: "#219C46", label: "PRO" },
  agency: { bg: "rgba(139,92,246,0.12)", text: "#8B5CF6", label: "AGENCY" },
};

function rub(minor: number) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function pct(r: number) {
  return `${(r * 100).toFixed(1)}%`;
}

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free;
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#64748B" }}>
          {label}
        </span>
        <div className="rounded-lg p-2" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-3xl font-extrabold" style={{ color: "#F1F5F9" }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "#64748B" }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs shrink-0" style={{ color: "#94A3B8" }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold" style={{ color: "#F1F5F9" }}>{value}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<FunnelMetricsResponse | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, u] = await Promise.all([fetchAdminMetrics(), fetchAdminUsers()]);
        if (!alive) return;
        setMetrics(m);
        setUsers(u);
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) { router.push("/login"); return; }
        if (e instanceof ApiError && e.status === 404) { setError("Нет доступа — проверьте ADMIN_EMAILS в .env"); return; }
        setError("Ошибка загрузки данных");
      }
    })();
    return () => { alive = false; };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={32} style={{ color: "#EF4444" }} />
        <p className="text-sm" style={{ color: "#94A3B8" }}>{error}</p>
      </div>
    );
  }

  const planCounts = users ? {
    free: users.items.filter(u => u.plan === "free").length,
    pro: users.items.filter(u => u.plan === "pro").length,
    agency: users.items.filter(u => u.plan === "agency").length,
  } : { free: 0, pro: 0, agency: 0 };

  const expiringSoon = users?.items.filter(u => {
    if (!u.plan_expires_at) return false;
    const days = (new Date(u.plan_expires_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>Дашборд</h1>
        <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
          Обзор метрик и активности платформы
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Всего пользователей"
          value={users?.total ?? "—"}
          sub={`FREE: ${planCounts.free} · PRO: ${planCounts.pro} · AGENCY: ${planCounts.agency}`}
          icon={Users}
          color="#219C46"
        />
        <KpiCard
          label="Платящих"
          value={users ? planCounts.pro + planCounts.agency : "—"}
          sub={metrics ? `Конверсия ${pct(metrics.pay_rate)}` : undefined}
          icon={CreditCard}
          color="#3B82F6"
        />
        <KpiCard
          label="MRR (выручка)"
          value={metrics ? rub(metrics.revenue_minor) : "—"}
          sub="Суммарно по всем платежам"
          icon={TrendingUp}
          color="#8B5CF6"
        />
        <KpiCard
          label="Истекают ≤30 дней"
          value={expiringSoon.length}
          sub="Требуют внимания"
          icon={AlertTriangle}
          color="#F59E0B"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funnel */}
        {metrics && (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: "#F1F5F9" }}>Воронка</h2>
              <Link
                href="/admin/funnel"
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: "#219C46" }}
              >
                Подробнее <ArrowRight size={12} />
              </Link>
            </div>
            <div className="space-y-3">
              <FunnelBar label="Регистрации" value={metrics.signups} max={metrics.signups} color="#219C46" />
              <FunnelBar label="Подключили Директ" value={metrics.connectors} max={metrics.signups} color="#3B82F6" />
              <FunnelBar label="Запустили агента" value={metrics.activators} max={metrics.signups} color="#8B5CF6" />
              <FunnelBar label="Оплатили" value={metrics.payers} max={metrics.signups} color="#F59E0B" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: "rgba(46,51,71,0.6)" }}>
              {[
                { label: "Connect rate", val: pct(metrics.connect_rate) },
                { label: "Activate rate", val: pct(metrics.activate_rate) },
                { label: "Pay rate", val: pct(metrics.pay_rate) },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <div className="text-lg font-extrabold" style={{ color: "#219C46" }}>{val}</div>
                  <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#64748B" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expiring */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: "#F1F5F9" }}>Истекают скоро</h2>
            <Link href="/admin/users" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "#219C46" }}>
              Все <ArrowRight size={12} />
            </Link>
          </div>
          {expiringSoon.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "#64748B" }}>
              Нет пользователей с истекающим планом в ближайшие 30 дней
            </p>
          ) : (
            <div className="space-y-2">
              {expiringSoon.slice(0, 8).map(u => {
                const days = Math.ceil((new Date(u.plan_expires_at!).getTime() - Date.now()) / 86400000);
                return (
                  <div key={u.id} className="flex items-center justify-between py-1.5">
                    <span className="text-xs font-medium" style={{ color: "#E2E8F0" }}>{u.email}</span>
                    <div className="flex items-center gap-2">
                      <PlanBadge plan={u.plan} />
                      <span className="text-[10px] font-semibold" style={{ color: days <= 7 ? "#EF4444" : "#F59E0B" }}>
                        {days}д
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent users table */}
      {users && users.items.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(46,51,71,0.6)" }}>
            <h2 className="text-sm font-bold" style={{ color: "#F1F5F9" }}>Последние регистрации</h2>
            <Link href="/admin/users" className="text-xs hover:underline" style={{ color: "#219C46" }}>
              Все пользователи →
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Пользователь", "Тариф", "Статус", "Дата регистрации"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]" style={{ color: "#64748B" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.items.slice(0, 8).map((u, i) => (
                <tr key={u.id} style={{ borderTop: i > 0 ? "1px solid rgba(46,51,71,0.5)" : undefined }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "#E2E8F0" }}>{u.email}</div>
                    {u.full_name && <div className="text-[11px]" style={{ color: "#64748B" }}>{u.full_name}</div>}
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold" style={{ color: u.is_active ? "#22C55E" : "#EF4444" }}>
                      {u.is_active ? "Активен" : "Заблокирован"}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#94A3B8" }}>
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
