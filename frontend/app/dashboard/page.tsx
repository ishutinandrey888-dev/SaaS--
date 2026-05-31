"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  AuthError,
  fetchDashboard,
  listAdAccounts,
  listAgents,
} from "@/lib/api";
import type {
  AdAccount,
  Agent,
  DashboardResponse,
  HistoryEntry,
} from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: DashboardResponse; agents: Agent[]; accounts: AdAccount[] }
  | { kind: "error"; message: string };

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
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-600">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-ink-600">{caption}</p>}
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <li className="card flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-200 text-ink-700">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {entry.agent_name}
          </p>
          <p className="mt-0.5 text-xs text-ink-600">
            {new Date(entry.started_at).toLocaleString("ru-RU")} ·{" "}
            {entry.findings} находок · {entry.applied} применено
          </p>
        </div>
      </div>
      <span
        className={
          "rounded-lg px-2.5 py-1 text-xs font-medium " +
          (entry.status === "succeeded"
            ? "bg-brand-700/20 text-brand-500"
            : entry.status === "running"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-rose-500/20 text-rose-400")
        }
      >
        {entry.status}
      </span>
    </li>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, agentsResp, accounts] = await Promise.all([
          fetchDashboard(),
          listAgents(),
          listAdAccounts(),
        ]);
        if (!cancelled) {
          setState({
            kind: "ready",
            data,
            agents: agentsResp.agents,
            accounts,
          });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthError) {
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-rose-400">{state.message}</p>
      </div>
    );
  }

  const { data, agents, accounts } = state;
  const hasAccounts = accounts.some((a) => a.status === "active");
  const hasAgents = agents.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-600">
            Главная
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Ваши AI-агенты
          </h1>
        </div>
        <span className="rounded-full bg-ink-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-700">
          Тариф: {data.plan}
        </span>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Активных агентов"
          value={data.totals.active_agents}
        />
        <MetricCard label="Запусков" value={data.totals.runs} caption="за период" />
        <MetricCard label="Применено" value={data.totals.applied} />
        <MetricCard label="Ждут проверки" value={data.totals.pending} />
      </section>

      {(!hasAccounts || !hasAgents) && (
        <section className="mt-8 card p-6">
          <h2 className="text-base font-semibold">Начните за 2 шага</h2>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              {hasAccounts ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-500" />
              ) : (
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-ink-500 text-[11px] text-ink-600">
                  1
                </span>
              )}
              <div className="flex-1">
                <p className="font-medium">Подключите Яндекс Директ</p>
                <p className="text-ink-600">
                  Без OAuth-токена агент не сможет читать кампании.
                </p>
              </div>
              {!hasAccounts && (
                <Link href="/yandex" className="btn-secondary">
                  Подключить
                </Link>
              )}
            </li>
            <li className="flex items-start gap-3">
              {hasAgents ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-500" />
              ) : (
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-ink-500 text-[11px] text-ink-600">
                  2
                </span>
              )}
              <div className="flex-1">
                <p className="font-medium">Создайте первого AI-агента</p>
                <p className="text-ink-600">
                  Бриф + KPI + режим — и агент начнёт работу.
                </p>
              </div>
              {!hasAgents && hasAccounts && (
                <Link href="/analyst/new" className="btn-primary">
                  Создать
                </Link>
              )}
            </li>
          </ol>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Агенты</h2>
          <Link
            href="/analyst/new"
            className="inline-flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600"
          >
            Новый агент
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {agents.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-600">
            <Bot className="mx-auto mb-3 h-8 w-8 text-ink-500" />
            Пока нет ни одного агента.
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {agents.map((a) => (
              <li key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="mt-1 text-xs text-ink-600">
                      Режим: {a.mode} · Статус: {a.status}
                    </p>
                  </div>
                  <Link
                    href={`/analyst/${a.id}`}
                    className="btn-ghost text-xs"
                  >
                    Открыть →
                  </Link>
                </div>
                {a.last_run_at && (
                  <p className="mt-3 text-xs text-ink-600">
                    Последний запуск:{" "}
                    {new Date(a.last_run_at).toLocaleString("ru-RU")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Последние запуски</h2>
          <span className="text-xs text-ink-600">
            {data.history.length} записей
          </span>
        </div>
        {data.history.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-600">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-ink-500" />
            Запустите первого агента, чтобы увидеть историю.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.history.map((h) => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </ul>
        )}
      </section>

      {!hasAccounts && (
        <section className="mt-10 card flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Megaphone className="h-5 w-5 text-brand-500" />
            <p className="text-sm">
              Подключите Яндекс Директ — чтобы агент получил доступ к кампаниям.
            </p>
          </div>
          <Link href="/yandex" className="btn-primary">
            Перейти
          </Link>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
