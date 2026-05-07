"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  approveFinding,
  AuthError,
  launchAgent,
  listAgentFindings,
  listAgentRuns,
  listAgents,
  patchAgent,
  pauseAgent,
  rejectFinding,
  runAgent,
} from "@/lib/api";
import type { Agent, AgentMode, Finding, Run } from "@/lib/types";

const MODES: { id: AgentMode; label: string; hint: string }[] = [
  { id: "advisor", label: "Советник", hint: "Только сообщает" },
  { id: "assistant", label: "Ассистент", hint: "Предлагает действия" },
  { id: "auto", label: "Автопилот", hint: "Применяет сам" },
];

function severityClass(s: Finding["severity"]) {
  if (s === "critical") return "text-rose-400 bg-rose-500/10";
  if (s === "warning") return "text-amber-400 bg-amber-500/10";
  if (s === "opportunity") return "text-brand-500 bg-brand-700/15";
  return "text-ink-700 bg-ink-200";
}

function FindingCard({
  f,
  mode,
  onApprove,
  onReject,
}: {
  f: Finding;
  mode: AgentMode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const canAct = mode === "assistant" && f.state === "new";
  return (
    <li className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={
                "rounded-md px-2 py-0.5 text-xs font-medium " +
                severityClass(f.severity)
              }
            >
              {f.severity}
            </span>
            <span className="rounded-md bg-ink-200 px-2 py-0.5 text-xs text-ink-700">
              {f.confidence}%
            </span>
            {f.state === "applied" && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-500">
                <CheckCircle2 className="h-3 w-3" />
                Применено
              </span>
            )}
            {f.state === "rejected" && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                <XCircle className="h-3 w-3" />
                Отклонено
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium text-ink-900">{f.title}</p>
          {f.effect && (
            <p className="mt-1 text-xs text-ink-600">{f.effect}</p>
          )}
        </div>
        {canAct && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => onApprove(f.id)}
            >
              Применить
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => onReject(f.id)}
            >
              Скрыть
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function AgentDetailContent({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [list, fs, rs] = await Promise.all([
        listAgents(),
        listAgentFindings(agentId),
        listAgentRuns(agentId),
      ]);
      const found = list.agents.find((a) => a.id === agentId) ?? null;
      setAgent(found);
      setFindings(fs.findings);
      setRuns(rs.runs);
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
  }, [agentId]);

  const handleMode = async (mode: AgentMode) => {
    if (!agent) return;
    setBusy(true);
    try {
      await patchAgent(agent.id, { mode });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async () => {
    if (!agent) return;
    setBusy(true);
    try {
      await runAgent(agent.id);
      setTimeout(refresh, 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleLaunch = async () => {
    if (!agent) return;
    setBusy(true);
    try {
      await launchAgent(agent.id);
      setTimeout(refresh, 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    if (!agent) return;
    setBusy(true);
    try {
      await pauseAgent(agent.id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveFinding(id);
      setTimeout(refresh, 800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectFinding(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  if (!agent && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }
  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <p className="text-rose-400">{error ?? "Агент не найден"}</p>
        <Link href="/analyst" className="btn-secondary mt-6">
          Назад к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <Link
        href="/analyst"
        className="text-xs text-ink-600 hover:text-ink-900"
      >
        ← Все агенты
      </Link>
      <header className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {agent.name}
          </h1>
          <p className="mt-1 text-xs text-ink-600">
            Создан {new Date(agent.created_at).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div className="flex gap-2">
          {agent.status === "active" ? (
            <button
              type="button"
              onClick={handlePause}
              disabled={busy}
              className="btn-secondary"
            >
              <Pause className="h-4 w-4" />
              На паузу
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={busy}
              className="btn-primary"
            >
              <Play className="h-4 w-4" />
              Запустить
            </button>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={busy}
            className="btn-ghost"
            title="Запустить разовый аудит"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="mt-8 card p-5">
        <p className="text-xs uppercase tracking-wide text-ink-600">
          Режим работы
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={busy}
              onClick={() => handleMode(m.id)}
              className={
                "rounded-xl border px-4 py-3 text-left text-sm transition " +
                (agent.mode === m.id
                  ? "border-brand-700 bg-brand-700/15 text-brand-500"
                  : "border-ink-300/60 bg-ink-50 text-ink-700 hover:border-ink-500")
              }
            >
              <p className="font-semibold">{m.label}</p>
              <p className="mt-0.5 text-xs text-ink-600">{m.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Находки</h2>
          <span className="text-xs text-ink-600">{findings.length}</span>
        </div>
        {findings.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-600">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-ink-500" />
            Пока нет находок. Запустите агента, чтобы получить первый аудит.
          </div>
        ) : (
          <ul className="space-y-3">
            {findings.map((f) => (
              <FindingCard
                key={f.id}
                f={f}
                mode={agent.mode}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">История запусков</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-ink-600">Запусков пока нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-100 px-4 py-3"
              >
                <span>{new Date(r.started_at).toLocaleString("ru-RU")}</span>
                <span className="text-xs text-ink-600">
                  {String((r.stats as { findings?: number }).findings ?? 0)} находок
                </span>
                <span
                  className={
                    "rounded-md px-2 py-0.5 text-xs " +
                    (r.status === "succeeded"
                      ? "bg-brand-700/20 text-brand-500"
                      : r.status === "failed"
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-amber-500/20 text-amber-400")
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell>
      <AgentDetailContent agentId={params.id} />
    </AppShell>
  );
}
