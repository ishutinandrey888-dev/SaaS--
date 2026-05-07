"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogOut, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  ApiError,
  AuthError,
  createPayment,
  fetchDashboard,
  fetchMe,
  fetchPlans,
  logout,
} from "@/lib/api";
import type {
  DashboardResponse,
  Me,
  PaidPlanId,
  PlanId,
  PlanInfo,
} from "@/lib/types";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      me: Me;
      dashboard: DashboardResponse;
      plans: PlanInfo[];
    }
  | { kind: "error"; message: string };

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, agency: 2 };

function priceLabel(plan: PlanInfo): string {
  if (plan.price_rub === 0) return "Бесплатно (7 дней trial)";
  return `${plan.price_rub.toLocaleString("ru-RU")} ₽/мес`;
}

function formatLimit(value: number | null): string {
  return value === null ? "∞" : String(value);
}

function SettingsContent() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [upgrading, setUpgrading] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, dashboard, plans] = await Promise.all([
          fetchMe(),
          fetchDashboard(),
          fetchPlans(),
        ]);
        if (!alive) return;
        setState({ kind: "ready", me, dashboard, plans: plans.plans });
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        const message =
          e instanceof ApiError
            ? `Ошибка сервера: ${e.message}`
            : "Не удалось загрузить настройки.";
        setState({ kind: "error", message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const onUpgrade = useCallback(
    async (plan: PaidPlanId) => {
      setUpgrading(plan);
      setError(null);
      try {
        const res = await createPayment(plan);
        window.location.href = res.confirmation_url;
      } catch (e) {
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        setError(
          e instanceof ApiError
            ? `Ошибка: ${e.message}`
            : "Не удалось создать платёж.",
        );
        setUpgrading(null);
      }
    },
    [router],
  );

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    }
    router.push("/login");
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
      <div className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-sm text-rose-400">{state.message}</p>
      </div>
    );
  }

  const { me, dashboard, plans } = state;
  const currentPlanId = dashboard.plan as PlanId;
  const currentPlan = plans.find((p) => p.id === currentPlanId);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-600">
          Настройки
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Аккаунт и тариф</h1>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="card mt-8 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
          Аккаунт
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Email">{me.email}</Row>
          {me.full_name && <Row label="Имя">{me.full_name}</Row>}
          <Row label="Статус">
            {me.is_verified ? "Подтверждён" : "Не подтверждён"}
          </Row>
        </dl>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="btn-secondary"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Выйти
          </button>
        </div>
      </section>

      <section className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
            Текущий тариф
          </h2>
          <span className="rounded-full bg-brand-700/20 px-3 py-1 text-xs font-medium text-brand-500">
            {currentPlan?.label ?? currentPlanId}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Cell
            label="Запусков использовано"
            used={dashboard.usage.uploads_used}
            limit={dashboard.limits.uploads}
          />
          <Cell
            label="AI-улучшений использовано"
            used={dashboard.usage.ai_ads_used}
            limit={dashboard.limits.ai_ads}
          />
          <Cell
            label="Осталось AI-улучшений"
            used={dashboard.usage.ai_ads_remaining ?? null}
            limit={null}
            isRemaining
          />
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
          Тарифы
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isDowngrade =
              PLAN_RANK[plan.id] < PLAN_RANK[currentPlanId];
            return (
              <article
                key={plan.id}
                className={
                  "flex flex-col rounded-2xl p-5 ring-1 transition " +
                  (isCurrent
                    ? "bg-brand-700/15 ring-brand-700/40"
                    : "bg-ink-50 ring-ink-300/40 hover:ring-ink-400")
                }
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{plan.label}</p>
                  {isCurrent && (
                    <CheckCircle2 className="h-4 w-4 text-brand-500" />
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-600">{priceLabel(plan)}</p>
                <ul className="mt-3 space-y-1 text-xs text-ink-700">
                  <li>Запусков: {formatLimit(plan.uploads_per_month)}/мес</li>
                  <li>AI-улучшений: {formatLimit(plan.ai_ads_per_period)}</li>
                  {plan.watermark && (
                    <li className="text-amber-400">С водяным знаком</li>
                  )}
                </ul>
                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="btn-secondary w-full text-xs"
                    >
                      Текущий тариф
                    </button>
                  ) : isDowngrade ? (
                    <p className="text-xs text-ink-600">
                      Понижение по запросу в поддержку.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUpgrade(plan.id as PaidPlanId)}
                      disabled={upgrading !== null}
                      className="btn-primary w-full text-xs"
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Перейти на {plan.label}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-600">
          Оплата через Robokassa. В демо-режиме платёж имитируется и
          возвращает на /billing/success мгновенно.
        </p>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-ink-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Cell({
  label,
  used,
  limit,
  isRemaining = false,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  isRemaining?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-ink-200/60 px-4 py-3">
      <p className="text-xs text-ink-600">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {used === null ? "∞" : used}
        {!isRemaining && (
          <span className="ml-1 text-sm font-normal text-ink-600">
            / {formatLimit(limit)}
          </span>
        )}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
