"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { ApiError, AuthError, fetchAdminMetrics } from "@/lib/api";
import type { FunnelMetricsResponse } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: FunnelMetricsResponse }
  | { kind: "denied" }
  | { kind: "error"; message: string };

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function rub(minor: number): string {
  const major = minor / 100;
  return `${major.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export default function AdminMetricsPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchAdminMetrics();
        if (alive) setState({ kind: "ready", data });
      } catch (error) {
        if (!alive) return;
        if (error instanceof AuthError) {
          router.push("/login");
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          // Admin gate hides the surface for non-admins.
          setState({ kind: "denied" });
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка: ${error.message}`
            : "Не удалось загрузить метрики.";
        setState({ kind: "error", message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        На главную
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-brand-600" />
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Метрики
        </h1>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Воронка: signup → upload → improve → pay
      </p>

      {state.kind === "loading" && (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      )}

      {state.kind === "denied" && (
        <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          Страница недоступна.
        </p>
      )}

      {state.kind === "error" && (
        <p className="mt-8 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <Stage label="Signups" value={state.data.signups} />
            <Stage
              label="Uploaders"
              value={state.data.uploaders}
              hint={`${pct(state.data.upload_rate)} от signup`}
            />
            <Stage
              label="Improvers"
              value={state.data.improvers}
              hint={`${pct(state.data.improve_rate)} от upload`}
            />
            <Stage
              label="Payers"
              value={state.data.payers}
              hint={`${pct(state.data.pay_rate)} от improve`}
            />
          </div>

          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
            <p className="text-xs uppercase tracking-wide text-emerald-700">
              Выручка (всего)
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">
              {rub(state.data.revenue_minor)}
            </p>
          </div>

          <FunnelTable data={state.data} />
        </>
      )}
    </main>
  );
}

function Stage({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-soft">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {value.toLocaleString("ru-RU")}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function FunnelTable({ data }: { data: FunnelMetricsResponse }) {
  const rows = [
    { from: "Signups", to: "Uploaders", num: data.uploaders, denom: data.signups, rate: data.upload_rate },
    { from: "Uploaders", to: "Improvers", num: data.improvers, denom: data.uploaders, rate: data.improve_rate },
    { from: "Improvers", to: "Payers", num: data.payers, denom: data.improvers, rate: data.pay_rate },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 text-left font-medium">Переход</th>
            <th className="px-5 py-3 text-right font-medium">Конверсия</th>
            <th className="px-5 py-3 text-right font-medium">N / N</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.from}>
              <td className="px-5 py-3 text-slate-700">
                {r.from} → {r.to}
              </td>
              <td className="px-5 py-3 text-right font-medium text-slate-900">
                {pct(r.rate)}
              </td>
              <td className="px-5 py-3 text-right text-slate-500">
                {r.num} / {r.denom}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
