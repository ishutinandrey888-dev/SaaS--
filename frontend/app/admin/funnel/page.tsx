"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiError, AuthError, fetchAdminMetrics } from "@/lib/api";
import type { FunnelMetricsResponse } from "@/lib/types";

function rub(minor: number) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}
function pct(r: number) {
  return `${(r * 100).toFixed(1)}%`;
}

const STEPS = [
  { key: "signups", label: "Регистрации", desc: "Создали аккаунт", color: "#219C46" },
  { key: "connectors", label: "Подключили Директ", desc: "OAuth прошёл успешно", color: "#3B82F6" },
  { key: "activators", label: "Запустили агента", desc: "Первый agent.launched", color: "#8B5CF6" },
  { key: "payers", label: "Оплатили", desc: "Хотя бы один succeeded платёж", color: "#F59E0B" },
] as const;

export default function AdminFunnelPage() {
  const router = useRouter();
  const [data, setData] = useState<FunnelMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetchAdminMetrics();
        if (alive) setData(m);
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) { router.push("/login"); return; }
        if (e instanceof ApiError && e.status === 404) { setError("Нет доступа"); return; }
        setError("Ошибка загрузки");
      }
    })();
    return () => { alive = false; };
  }, [router]);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle size={28} style={{ color: "#EF4444" }} />
      <p className="text-sm" style={{ color: "#94A3B8" }}>{error}</p>
    </div>
  );

  if (!data) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: "#219C46" }} />
    </div>
  );

  const max = data.signups || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>Воронка конверсии</h1>
        <p className="mt-1 text-sm" style={{ color: "#64748B" }}>signup → connect → activate → pay</p>
      </div>

      {/* Funnel steps */}
      <div
        className="rounded-xl p-6 space-y-5"
        style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
      >
        {STEPS.map(({ key, label, desc, color }) => {
          const val = data[key];
          const w = Math.round((val / max) * 100);
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold" style={{ color: "#E2E8F0" }}>{label}</span>
                  <span className="ml-2" style={{ color: "#64748B" }}>{desc}</span>
                </div>
                <span className="text-xl font-extrabold" style={{ color }}>{val}</span>
              </div>
              <div className="relative h-7 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                  style={{ width: `${w}%`, background: `${color}33` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                  style={{ width: `${Math.min(w, 3)}%`, minWidth: val > 0 ? "6px" : 0, background: color }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold" style={{ color: "#E2E8F0" }}>
                  {w}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Reg → Connect", val: pct(data.connect_rate), color: "#3B82F6" },
          { label: "Connect → Activate", val: pct(data.activate_rate), color: "#8B5CF6" },
          { label: "Activate → Pay", val: pct(data.pay_rate), color: "#F59E0B" },
          { label: "Выручка", val: rub(data.revenue_minor), color: "#219C46" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="rounded-xl p-5 text-center"
            style={{ background: "#161B22", border: "1px solid rgba(46,51,71,0.7)" }}
          >
            <div className="text-2xl font-extrabold" style={{ color }}>{val}</div>
            <div className="mt-1 text-[11px] uppercase tracking-widest font-semibold" style={{ color: "#64748B" }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
