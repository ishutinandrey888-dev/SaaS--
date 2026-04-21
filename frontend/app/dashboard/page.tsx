"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ApiError, AuthError, fetchDashboard } from "@/lib/api";
import type { DashboardResponse, HistoryEntry } from "@/lib/types";
import { cn, scoreTone } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: DashboardResponse }
  | { kind: "error"; message: string };

const TONE_CLASS = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
} as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const tone = scoreTone(entry.avg_score);
  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200/70 shadow-soft">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {entry.filename}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(entry.created_at)} · {entry.total_ads} объявлени
            {entry.total_ads === 1 ? "е" : "й"}
            {entry.total_campaigns > 0 &&
              ` · ${entry.total_campaigns} кампани${
                entry.total_campaigns === 1 ? "я" : "й"
              }`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            AI-улучшено
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-700">
            {entry.improved_count}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Score
          </p>
          <p className={cn("mt-0.5 text-sm font-semibold", TONE_CLASS[tone])}>
            {entry.avg_score.toFixed(1)}
          </p>
        </div>
      </div>
    </li>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-slate-500">{caption}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboard();
        if (!cancelled) setState({ kind: "ready", data });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthError) {
          window.alert("Требуется вход. Переадресация на /login.");
          router.push("/login");
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка сервера: ${error.message}`
            : "Не удалось загрузить дашборд.";
        setState({ kind: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-rose-600">{state.message}</p>
        <Link
          href="/"
          className="text-sm text-brand-700 hover:text-brand-900"
        >
          Вернуться на главную →
        </Link>
      </main>
    );
  }

  const { data } = state;
  const { totals, usage, limits, history } = data;
  const aiCaption =
    limits.ai_ads == null
      ? `Использовано ${usage.ai_ads_used}`
      : `Осталось ${usage.ai_ads_remaining ?? 0} из ${limits.ai_ads}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Загрузить ещё
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
          {data.plan}
          {limits.watermark && (
            <span className="inline-flex items-center gap-1 text-brand-700">
              <Sparkles className="h-3 w-3" />
              AI powered
            </span>
          )}
        </span>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Дашборд
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {data.history_days == null
            ? "Все ваши загрузки за всё время."
            : `Загрузки за последние ${data.history_days} дней.`}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard
          label="Загрузок"
          value={totals.uploads}
          caption={
            limits.uploads != null
              ? `${usage.uploads_used}/${limits.uploads} в этом месяце`
              : "без лимита"
          }
        />
        <MetricCard
          label="Объявлений"
          value={totals.ads}
          caption="за период"
        />
        <MetricCard
          label="Улучшено AI"
          value={totals.improved}
          caption={aiCaption}
        />
        <MetricCard
          label="Средний score"
          value={totals.avg_score.toFixed(1)}
          caption="за период"
        />
      </section>

      <section className="mt-8 space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-slate-900">История</h2>
          <span className="text-xs text-slate-500">
            {history.length} {history.length === 1 ? "запись" : "записей"}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200/70">
            <p className="text-sm text-slate-600">
              Загрузок пока нет — начните с первой.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              Загрузить Excel
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {history.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-auto pt-16 text-xs text-slate-400">
        {data.history_days != null && data.plan === "free"
          ? "На тарифе Free доступна история за 7 дней. Starter — 30 дней, Pro — без ограничений."
          : "История фиксируется автоматически после каждой загрузки."}
      </footer>
    </main>
  );
}
