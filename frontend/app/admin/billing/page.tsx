"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiError, AuthError, fetchAdminPayments } from "@/lib/api";
import type { AdminPaymentItem } from "@/lib/types";

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  pro: { bg: "rgba(33,156,70,0.12)", text: "#219C46" },
  agency: { bg: "rgba(139,92,246,0.12)", text: "#8B5CF6" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  succeeded: { bg: "rgba(34,197,94,0.12)", text: "#22C55E", label: "Оплачено" },
  pending: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", label: "Ожидание" },
  failed: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", label: "Ошибка" },
  canceled: { bg: "rgba(148,163,184,0.12)", text: "#94A3B8", label: "Отменён" },
};

function rub(minor: number) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export default function AdminBillingPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminPaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchAdminPayments();
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
  }, [router]);

  const totalRevenue = items.filter(p => p.status === "succeeded").reduce((s, p) => s + p.amount, 0);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle size={28} style={{ color: "#EF4444" }} />
      <p className="text-sm" style={{ color: "#94A3B8" }}>{error}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>Тарифы и оплаты</h1>
        <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Всего платежей: {total}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: "Выручка (succeeded)", val: rub(totalRevenue), color: "#219C46" },
          { label: "Успешных платежей", val: items.filter(p => p.status === "succeeded").length, color: "#22C55E" },
          { label: "Ошибок оплаты", val: items.filter(p => p.status === "failed").length, color: "#EF4444" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: "#64748B" }}>{label}</div>
            <div className="text-2xl font-extrabold" style={{ color }}>{val}</div>
          </div>
        ))}
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
        ) : items.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "#64748B" }}>Платежей пока нет</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Дата", "Пользователь", "Тариф", "Сумма", "Статус", "Провайдер"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]" style={{ color: "#64748B" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => {
                const pc = PLAN_COLORS[p.plan] ?? { bg: "rgba(148,163,184,0.12)", text: "#94A3B8" };
                const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.pending;
                return (
                  <tr key={p.id} style={{ borderTop: i > 0 ? "1px solid rgba(46,51,71,0.5)" : undefined }}>
                    <td className="px-4 py-3" style={{ color: "#94A3B8" }}>
                      {new Date(p.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "#E2E8F0" }}>{p.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
                        style={{ background: pc.bg, color: pc.text }}>
                        {p.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#F1F5F9" }}>{rub(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#64748B" }}>{p.provider}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
