"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApiError, AuthError, listAgents } from "@/lib/api";
import type { Agent } from "@/lib/types";

const MODE_LABEL: Record<string, string> = {
  advisor: "Советник",
  assistant: "Ассистент",
  auto: "Автопилот",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  active: "Активен",
  paused: "Пауза",
  archived: "В архиве",
};

function AnalystContent() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await listAgents();
        if (!cancelled) setAgents(r.agents);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (agents === null && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-600">
            AI-аналитик
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Ваши агенты
          </h1>
        </div>
        <Link href="/analyst/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          Новый агент
        </Link>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="mt-8">
        {agents && agents.length === 0 ? (
          <div className="card p-10 text-center">
            <Bot className="mx-auto h-10 w-10 text-ink-500" />
            <p className="mt-4 text-sm font-medium">У вас ещё нет агентов</p>
            <p className="mt-1 text-xs text-ink-600">
              Создайте первого AI-агента — пройдите 4-шаговый бриф.
            </p>
            <Link href="/analyst/new" className="btn-primary mt-6">
              Создать агента
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {(agents ?? []).map((a) => (
              <li key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">{a.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-ink-200 px-2 py-0.5 text-ink-700">
                        {MODE_LABEL[a.mode] ?? a.mode}
                      </span>
                      <span
                        className={
                          "rounded-md px-2 py-0.5 " +
                          (a.status === "active"
                            ? "bg-brand-700/20 text-brand-500"
                            : a.status === "paused"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-ink-200 text-ink-700")
                        }
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/analyst/${a.id}`}
                    className="btn-secondary text-xs"
                  >
                    Открыть
                  </Link>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  {a.kpi.cpa != null && (
                    <div>
                      <dt className="text-ink-600">CPA цель</dt>
                      <dd className="mt-0.5 text-ink-900">{a.kpi.cpa} ₽</dd>
                    </div>
                  )}
                  {a.kpi.ctr != null && (
                    <div>
                      <dt className="text-ink-600">CTR цель</dt>
                      <dd className="mt-0.5 text-ink-900">{a.kpi.ctr}%</dd>
                    </div>
                  )}
                  {a.kpi.romi != null && (
                    <div>
                      <dt className="text-ink-600">ROMI</dt>
                      <dd className="mt-0.5 text-ink-900">{a.kpi.romi}%</dd>
                    </div>
                  )}
                  {a.kpi.budget != null && (
                    <div>
                      <dt className="text-ink-600">Бюджет</dt>
                      <dd className="mt-0.5 text-ink-900">
                        {a.kpi.budget} ₽/день
                      </dd>
                    </div>
                  )}
                </dl>
                {a.last_run_at && (
                  <p className="mt-4 text-xs text-ink-600">
                    Последний запуск:{" "}
                    {new Date(a.last_run_at).toLocaleString("ru-RU")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AnalystPage() {
  return (
    <AppShell>
      <AnalystContent />
    </AppShell>
  );
}
