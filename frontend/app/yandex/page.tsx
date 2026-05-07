"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Megaphone, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  AuthError,
  createProject,
  disconnectAdAccount,
  listAdAccounts,
  listProjects,
  startYandexOAuth,
} from "@/lib/api";
import type { AdAccount, Project } from "@/lib/types";

function YandexContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [pl, as] = await Promise.all([listProjects(), listAdAccounts()]);
      setProjects(pl.projects);
      setAccounts(as);
    } catch (e) {
      if (e instanceof AuthError) {
        router.push("/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureProject = async (): Promise<Project> => {
    if (projects.length > 0) return projects[0];
    const p = await createProject("Мой проект");
    setProjects([p]);
    return p;
  };

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const project = await ensureProject();
      const start = await startYandexOAuth(project.id);
      const popup = window.open(start.url, "yandex-oauth", "width=600,height=700");
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === "yandex-oauth") {
          popup?.close();
          window.removeEventListener("message", onMessage);
          refresh();
        }
      };
      window.addEventListener("message", onMessage);
      // Stub mode — refresh after a beat in case the popup closes silently.
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Отключить аккаунт? Агенты, использующие его, остановятся."))
      return;
    try {
      await disconnectAdAccount(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отключить");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-600">
            Яндекс Директ
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Подключённые аккаунты
          </h1>
        </div>
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Подключить аккаунт
        </button>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="mt-8">
        {accounts.length === 0 ? (
          <div className="card p-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-ink-500" />
            <p className="mt-4 text-sm font-medium">
              Нет подключённых аккаунтов Яндекс Директ
            </p>
            <p className="mt-1 text-xs text-ink-600">
              Подключите хотя бы один аккаунт, чтобы AI-агенты могли работать с
              кампаниями.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="btn-primary mt-6"
            >
              Подключить через Яндекс
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="card flex items-center justify-between gap-4 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-200">
                    <Megaphone className="h-5 w-5 text-brand-500" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{a.external_id}</p>
                    <p className="mt-0.5 text-xs text-ink-600">
                      Подключён{" "}
                      {new Date(a.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700/15 px-2.5 py-1 text-xs font-medium text-brand-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Активен
                    </span>
                  ) : (
                    <span className="rounded-full bg-ink-200 px-2.5 py-1 text-xs text-ink-600">
                      {a.status}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDisconnect(a.id)}
                    className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-200 hover:text-rose-400"
                    title="Отключить"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-xs text-ink-600">
        В демо-режиме (без YANDEX_DIRECT_CLIENT_ID) подключение фабрикует
        фейковый аккаунт. См.{" "}
        <Link href="/help" className="text-brand-500 hover:text-brand-600">
          Центр помощи
        </Link>
        .
      </p>
    </div>
  );
}

export default function YandexPage() {
  return (
    <AppShell>
      <YandexContent />
    </AppShell>
  );
}
