"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  AuthError,
  approveFinding,
  listAgentFindings,
  listAgents,
  rejectFinding,
} from "@/lib/api";
import type { Agent, Finding } from "@/lib/types";

interface AnnotatedFinding extends Finding {
  agent: Agent;
}

function severityClass(s: Finding["severity"]) {
  if (s === "critical") return "text-rose-400 bg-rose-500/10";
  if (s === "warning") return "text-amber-400 bg-amber-500/10";
  if (s === "opportunity") return "text-brand-500 bg-brand-700/15";
  return "text-ink-700 bg-ink-200";
}

function OpportunitiesContent() {
  const router = useRouter();
  const [items, setItems] = useState<AnnotatedFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await listAgents();
      const all = await Promise.all(
        list.agents.map(async (a) => {
          const fs = await listAgentFindings(a.id);
          return fs.findings
            .filter((f) => f.state === "new")
            .map<AnnotatedFinding>((f) => ({ ...f, agent: a }));
        }),
      );
      setItems(all.flat().sort((a, b) => b.confidence - a.confidence));
    } catch (e) {
      if (e instanceof AuthError) {
        router.push("/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items === null && !error) {
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
          Возможности
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Точки роста по всем агентам
        </h1>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="mt-8">
        {!items || items.length === 0 ? (
          <div className="card p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-ink-500" />
            <p className="mt-4 text-sm text-ink-700">
              Сейчас нет открытых находок.
            </p>
            <Link href="/analyst" className="btn-primary mt-6">
              Перейти к агентам
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((f) => (
              <li key={f.id} className="card p-5">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      "rounded-md px-2 py-0.5 font-medium " +
                      severityClass(f.severity)
                    }
                  >
                    {f.severity}
                  </span>
                  <span className="rounded-md bg-ink-200 px-2 py-0.5 text-ink-700">
                    {f.confidence}%
                  </span>
                  <Link
                    href={`/analyst/${f.agent.id}`}
                    className="ml-auto text-ink-600 hover:text-ink-900"
                  >
                    {f.agent.name} →
                  </Link>
                </div>
                <p className="mt-2 text-sm font-medium">{f.title}</p>
                {f.effect && (
                  <p className="mt-1 text-xs text-ink-600">{f.effect}</p>
                )}
                {f.agent.mode === "assistant" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={async () => {
                        await approveFinding(f.id);
                        refresh();
                      }}
                    >
                      Применить
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={async () => {
                        await rejectFinding(f.id);
                        refresh();
                      }}
                    >
                      Скрыть
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <AppShell>
      <OpportunitiesContent />
    </AppShell>
  );
}
