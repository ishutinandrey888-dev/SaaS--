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
  return `${(minor / 100).toLocaleString("ru-RU", {
    maximumFractionDigits: 0,
  })} ₽`;
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
          setState({ kind: "denied" });
          return;
        }
        setState({
          kind: "error",
          message:
            error instanceof ApiError
              ? `Ошибка: ${error.message}`
              : "Не удалось загрузить метрики.",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        В дашборд
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-brand-500" />
        <h1 className="text-3xl font-semibold tracking-tight">Метрики</h1>
      </div>
      <p className="mt-2 text-sm text-ink-600">
        Воронка: signup → connect → activate → pay
      </p>

      {state.kind === "loading" && (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      )}

      {state.kind === "denied" && (
        <p className="mt-8 rounded-xl bg-ink-100 px-4 py-3 text-sm text-ink-600 ring-1 ring-ink-300/40">
          Страница недоступна.
        </p>
      )}

      {state.kind === "error" && (
        <p className="mt-8 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <Stage label="Signups" value={state.data.signups} />
            <Stage
              label="Connectors"
              value={state.data.connectors}
              hint={`${pct(state.data.connect_rate)} от signup`}
            />
            <Stage
              label="Activators"
              value={state.data.activators}
              hint={`${pct(state.data.activate_rate)} от connect`}
            />
            <Stage
              label="Payers"
              value={state.data.payers}
              hint={`${pct(state.data.pay_rate)} от activate`}
            />
          </div>

          <div className="card mt-6 p-5">
            <p className="text-xs uppercase tracking-wide text-brand-500">
              Выручка (всего)
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {rub(state.data.revenue_minor)}
            </p>
          </div>
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
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value.toLocaleString("ru-RU")}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </div>
  );
}
