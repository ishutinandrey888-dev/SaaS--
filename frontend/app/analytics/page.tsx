"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApiError, AuthError, fetchDashboard } from "@/lib/api";
import type { DashboardResponse } from "@/lib/types";

function AnalyticsContent() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchDashboard();
        if (!cancelled) setData(d);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!data && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-600">
          Аналитика
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Сводка</h1>
      </header>

      {error && <p className="mt-6 text-sm text-rose-400">{error}</p>}

      {data && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Активных агентов" value={data.totals.active_agents} />
          <Card label="Запусков" value={data.totals.runs} />
          <Card label="Применено" value={data.totals.applied} />
          <Card label="Ждут проверки" value={data.totals.pending} />
        </section>
      )}

      <p className="mt-10 text-xs text-ink-600">
        Расширенная аналитика по кампаниям появится в следующей итерации.
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-ink-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AppShell>
      <AnalyticsContent />
    </AppShell>
  );
}
