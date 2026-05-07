"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  AuthError,
  createAgent,
  createProject,
  launchAgent,
  listAdAccounts,
  listProjects,
} from "@/lib/api";
import type {
  AdAccount,
  AgentBrief,
  AgentKpi,
  AgentMode,
  Project,
} from "@/lib/types";

const STEPS = [
  { n: 1, title: "Аккаунты" },
  { n: 2, title: "KPI и цели" },
  { n: 3, title: "Бриф" },
  { n: 4, title: "Запуск" },
];

const MODES: { id: AgentMode; label: string; desc: string }[] = [
  {
    id: "advisor",
    label: "Советник",
    desc: "Только показывает находки. Действия не применяет.",
  },
  {
    id: "assistant",
    label: "Ассистент",
    desc: "Предлагает действия. Применяет после вашего подтверждения.",
  },
  {
    id: "auto",
    label: "Автопилот",
    desc: "Применяет находки с уверенностью ≥ 90% самостоятельно.",
  },
];

function WizardContent() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("Мой первый AI-агент");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [kpi, setKpi] = useState<AgentKpi>({});
  const [brief, setBrief] = useState<AgentBrief>({});
  const [mode, setMode] = useState<AgentMode>("advisor");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [as, pl] = await Promise.all([listAdAccounts(), listProjects()]);
        if (cancelled) return;
        const active = as.filter((a) => a.status === "active");
        setAccounts(active);
        setProjects(pl.projects);
        if (active.length === 1) setSelectedAccountIds([active[0].id]);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const ensureProject = async (): Promise<Project> => {
    if (projects.length > 0) return projects[0];
    const p = await createProject("Мой проект");
    setProjects([p]);
    return p;
  };

  const handleSubmit = async () => {
    if (selectedAccountIds.length === 0) {
      setError("Выберите хотя бы один Direct-аккаунт");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await ensureProject();
      const created = await createAgent({
        project_id: project.id,
        name,
        mode,
        brief,
        kpi,
        ad_account_ids: selectedAccountIds,
      });
      await launchAgent(created.id);
      router.push(`/analyst/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 text-center">
        <h1 className="text-2xl font-semibold">Сначала подключите аккаунт</h1>
        <p className="mt-2 text-sm text-ink-600">
          Чтобы создать агента, нужен хотя бы один аккаунт Яндекс Директ.
        </p>
        <Link href="/yandex" className="btn-primary mt-6">
          Подключить Яндекс Директ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link href="/analyst" className="text-xs text-ink-600 hover:text-ink-900">
        ← Назад к агентам
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Новый AI-агент
      </h1>

      <ol className="mt-6 grid grid-cols-4 gap-2 text-xs">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className={
              "rounded-xl border px-3 py-2 " +
              (step >= s.n
                ? "border-brand-700 bg-brand-700/15 text-brand-500"
                : "border-ink-300/60 bg-ink-100 text-ink-600")
            }
          >
            <div className="flex items-center gap-1.5">
              {step > s.n ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span>{s.n}.</span>
              )}
              <span>{s.title}</span>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="card mt-6 p-6">
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold">Какие аккаунты Директа подключаем?</h2>
            <p className="mt-1 text-xs text-ink-600">
              Можно выбрать несколько — агент будет следить за каждым.
            </p>
            <ul className="mt-4 space-y-2">
              {accounts.map((a) => {
                const checked = selectedAccountIds.includes(a.id);
                return (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-ink-100 px-4 py-3 ring-1 ring-ink-300/40 hover:bg-ink-200">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedAccountIds((prev) =>
                            prev.includes(a.id)
                              ? prev.filter((x) => x !== a.id)
                              : [...prev, a.id],
                          );
                        }}
                      />
                      <span className="text-sm">{a.external_id}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-base font-semibold">Какие KPI отслеживаем?</h2>
            <p className="mt-1 text-xs text-ink-600">
              Все поля опциональны — агент использует то, что укажете.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="CPA, ₽">
                <input
                  type="number"
                  className="input"
                  value={kpi.cpa ?? ""}
                  onChange={(e) =>
                    setKpi({ ...kpi, cpa: numOrUndef(e.target.value) })
                  }
                />
              </Field>
              <Field label="CTR, %">
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={kpi.ctr ?? ""}
                  onChange={(e) =>
                    setKpi({ ...kpi, ctr: numOrUndef(e.target.value) })
                  }
                />
              </Field>
              <Field label="ROMI, %">
                <input
                  type="number"
                  className="input"
                  value={kpi.romi ?? ""}
                  onChange={(e) =>
                    setKpi({ ...kpi, romi: numOrUndef(e.target.value) })
                  }
                />
              </Field>
              <Field label="Дневной бюджет, ₽">
                <input
                  type="number"
                  className="input"
                  value={kpi.budget ?? ""}
                  onChange={(e) =>
                    setKpi({ ...kpi, budget: numOrUndef(e.target.value) })
                  }
                />
              </Field>
              <Field label="Цель" full>
                <input
                  type="text"
                  className="input"
                  placeholder="например, заявки или продажи"
                  value={kpi.goal ?? ""}
                  onChange={(e) =>
                    setKpi({ ...kpi, goal: e.target.value || undefined })
                  }
                />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-base font-semibold">Расскажите о бизнесе</h2>
            <p className="mt-1 text-xs text-ink-600">
              Это контекст для AI — чем подробнее, тем точнее предложения.
            </p>
            <div className="mt-4 grid gap-3">
              <Field label="Сайт / посадка" full>
                <input
                  type="url"
                  className="input"
                  placeholder="https://example.com"
                  value={brief.url ?? ""}
                  onChange={(e) =>
                    setBrief({ ...brief, url: e.target.value || undefined })
                  }
                />
              </Field>
              <Field label="Ниша" full>
                <input
                  type="text"
                  className="input"
                  value={brief.niche ?? ""}
                  onChange={(e) =>
                    setBrief({ ...brief, niche: e.target.value || undefined })
                  }
                />
              </Field>
              <Field label="Аудитория" full>
                <input
                  type="text"
                  className="input"
                  value={brief.audience ?? ""}
                  onChange={(e) =>
                    setBrief({
                      ...brief,
                      audience: e.target.value || undefined,
                    })
                  }
                />
              </Field>
              <Field label="География" full>
                <input
                  type="text"
                  className="input"
                  placeholder="Москва, СПб"
                  value={brief.geo ?? ""}
                  onChange={(e) =>
                    setBrief({ ...brief, geo: e.target.value || undefined })
                  }
                />
              </Field>
              <Field label="Дополнительно" full>
                <textarea
                  rows={3}
                  className="input"
                  value={brief.notes ?? ""}
                  onChange={(e) =>
                    setBrief({ ...brief, notes: e.target.value || undefined })
                  }
                />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-base font-semibold">Как должен работать агент?</h2>
            <p className="mt-1 text-xs text-ink-600">
              Режим можно поменять в любой момент.
            </p>
            <div className="mt-4 grid gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={
                    "rounded-xl border px-4 py-3 text-left transition " +
                    (mode === m.id
                      ? "border-brand-700 bg-brand-700/15"
                      : "border-ink-300/60 bg-ink-100 hover:border-ink-500")
                  }
                >
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="mt-0.5 text-xs text-ink-600">{m.desc}</p>
                </button>
              ))}
            </div>
            <Field label="Имя агента" full>
              <input
                type="text"
                className="input mt-4"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="btn-ghost"
          >
            Назад
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={step === 1 && selectedAccountIds.length === 0}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              className="btn-primary"
            >
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className="btn-primary"
            >
              {submitting ? "Создаём…" : "Создать и запустить"}
            </button>
          )}
        </div>
      </section>

      <style jsx global>{`
        .input {
          width: 100%;
          background: rgb(20 26 35); /* ink-100 */
          border: 1px solid rgba(58, 69, 85, 0.6); /* ink-400 */
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(242 245 250);
        }
        .input:focus {
          outline: none;
          border-color: rgb(33 156 70);
          box-shadow: 0 0 0 2px rgba(33, 156, 70, 0.3);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <span className="text-xs uppercase tracking-wide text-ink-600">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function numOrUndef(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function AgentWizardPage() {
  return (
    <AppShell>
      <WizardContent />
    </AppShell>
  );
}
