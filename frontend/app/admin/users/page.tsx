"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { ApiError, AuthError, fetchAdminUsers } from "@/lib/api";
import type { AdminUserItem } from "@/lib/types";

const PLANS = ["", "free", "pro", "agency"];

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: "rgba(148,163,184,0.12)", text: "#94A3B8" },
  pro: { bg: "rgba(33,156,70,0.12)", text: "#219C46" },
  agency: { bg: "rgba(139,92,246,0.12)", text: "#8B5CF6" },
};

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free;
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {plan}
    </span>
  );
}

function expiresLabel(u: AdminUserItem) {
  if (!u.plan_expires_at) return <span style={{ color: "#64748B" }}>—</span>;
  const days = Math.ceil((new Date(u.plan_expires_at).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "#EF4444" : days <= 7 ? "#F59E0B" : "#94A3B8";
  const label = days < 0 ? `Истёк ${Math.abs(days)}д назад` : `${days}д`;
  return <span style={{ color, fontSize: 11 }}>{label}</span>;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchAdminUsers(plan || undefined);
        if (!alive) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) { router.push("/login"); return; }
        if (e instanceof ApiError && e.status === 404) { setError("Нет доступа"); return; }
        setError("Ошибка загрузки");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router, plan]);

  const filtered = search
    ? items.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase()))
    : items;

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle size={28} style={{ color: "#EF4444" }} />
      <p className="text-sm" style={{ color: "#94A3B8" }}>{error}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>Пользователи</h1>
        <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Всего: {total}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 max-w-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(46,51,71,0.8)" }}
        >
          <Search size={14} style={{ color: "#64748B" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по email..."
            className="bg-transparent text-xs outline-none flex-1"
            style={{ color: "#E2E8F0" }}
          />
        </div>

        <div className="flex gap-1">
          {PLANS.map(p => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                plan === p
                  ? { background: "rgba(33,156,70,0.15)", color: "#219C46" }
                  : { background: "rgba(255,255,255,0.04)", color: "#94A3B8" }
              }
            >
              {p || "Все"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: "#219C46" }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "#64748B" }}>Пусто</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Пользователь", "Тариф", "Статус", "Истекает", "Дата регистрации"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]" style={{ color: "#64748B" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderTop: i > 0 ? "1px solid rgba(46,51,71,0.5)" : undefined }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "#E2E8F0" }}>{u.email}</div>
                    {u.full_name && <div style={{ color: "#64748B" }}>{u.full_name}</div>}
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: u.is_active ? "#22C55E" : "#EF4444" }}
                    >
                      {u.is_active ? "Активен" : "Заблокирован"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{expiresLabel(u)}</td>
                  <td className="px-4 py-3" style={{ color: "#94A3B8" }}>
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
