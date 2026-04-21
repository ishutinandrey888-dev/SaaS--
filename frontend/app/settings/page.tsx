"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ApiError,
  AuthError,
  fetchDashboard,
  fetchMe,
  fetchPlans,
  logout,
  postUpgradeIntent,
} from "@/lib/api";
import type {
  DashboardResponse,
  Me,
  PlanId,
  PlanInfo,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      me: Me;
      dashboard: DashboardResponse;
      plans: PlanInfo[];
    }
  | { kind: "error"; message: string };

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatLimit(value: number | null): string {
  return value === null ? "∞" : String(value);
}

function priceLabel(plan: PlanInfo): string {
  if (plan.price_rub === 0) return "Бесплатно";
  return `${plan.price_rub.toLocaleString("ru-RU")} ₽/мес`;
}

export default function SettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [upgrading, setUpgrading] = useState<PlanId | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
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
      } catch (error) {
        if (!alive) return;
        if (error instanceof AuthError) {
          router.push("/login");
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка сервера: ${error.message}`
            : "Не удалось загрузить настройки.";
        setState({ kind: "error", message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const onUpgrade = useCallback(
    async (plan: PlanId) => {
      setUpgrading(plan);
      setUpgradeMessage(null);
      try {
        const res = await postUpgradeIntent({
          plan,
          trigger: "settings_page",
        });
        setUpgradeMessage(
          res.message ||
            "Заявка принята. Мы напишем вам на почту с инструкциями по оплате.",
        );
      } catch (error) {
        if (error instanceof AuthError) {
          router.push("/login");
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка: ${error.message}`
            : "Не удалось отправить заявку.";
        setUpgradeMessage(message);
      } finally {
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
      // Fall through to redirect regardless — the cookie is our only state.
    }
    router.push("/login");
  }, [router]);

  if (state.kind === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>
        <p className="mt-8 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.message}
        </p>
      </main>
    );
  }

  const { me, dashboard, plans } = state;
  const currentPlanId = dashboard.plan;
  const currentPlan = plans.find((p) => p.id === currentPlanId);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>
        <Link
          href="/dashboard"
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Дашборд
        </Link>
      </header>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
        Настройки
      </h1>

      {/* Account */}
      <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 shadow-soft">
        <h2 className="text-sm font-semibold text-slate-900">Аккаунт</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Email">
            <span className="text-slate-900">{me.email}</span>
          </Row>
          {me.full_name && (
            <Row label="Имя">
              <span className="text-slate-900">{me.full_name}</span>
            </Row>
          )}
          <Row label="Зарегистрирован">
            <span className="text-slate-700">{formatDate(me.created_at)}</span>
          </Row>
          <Row label="Статус">
            <Badge tone={me.is_verified ? "good" : "warn"}>
              {me.is_verified ? "подтверждён" : "не подтверждён"}
            </Badge>
          </Row>
        </dl>
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Выйти
          </Button>
        </div>
      </section>

      {/* Current plan + usage */}
      <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Текущий тариф</h2>
          <Badge tone="brand">{currentPlan?.label ?? currentPlanId}</Badge>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <UsageCell
            label="Загрузки в месяце"
            used={dashboard.usage.uploads_used}
            limit={dashboard.limits.uploads}
          />
          <UsageCell
            label="AI-улучшений использовано"
            used={dashboard.usage.ai_ads_used}
            limit={dashboard.limits.ai_ads}
          />
          <UsageCell
            label="Осталось AI-улучшений"
            used={dashboard.usage.ai_ads_remaining ?? null}
            limit={null}
            isRemaining
          />
        </div>
      </section>

      {/* Plan picker */}
      <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 shadow-soft">
        <h2 className="text-sm font-semibold text-slate-900">Тарифы</h2>
        <p className="mt-1 text-xs text-slate-500">
          Оплата по счёту: отправьте заявку, и мы пришлём реквизиты на почту.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isDowngrade =
              PLAN_RANK[plan.id] < PLAN_RANK[currentPlanId];
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl p-5 ring-1 transition",
                  isCurrent
                    ? "bg-brand-50 ring-brand-200"
                    : "bg-white ring-slate-200 hover:ring-slate-300",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {plan.label}
                  </p>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Активен
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {priceLabel(plan)}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  <li>
                    Загрузок: {formatLimit(plan.uploads_per_month)} / мес
                  </li>
                  <li>
                    Объявлений за загрузку: {plan.max_ads_per_upload}
                  </li>
                  <li>
                    AI-улучшений: {formatLimit(plan.ai_ads_per_period)}
                  </li>
                  {plan.watermark && (
                    <li className="text-amber-700">С водяным знаком</li>
                  )}
                </ul>
                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled
                      className="w-full"
                    >
                      Текущий тариф
                    </Button>
                  ) : isDowngrade ? (
                    <p className="text-xs text-slate-400">
                      Понижение доступно по запросу в поддержку.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      disabled={upgrading !== null}
                      onClick={() => onUpgrade(plan.id)}
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Перейти на {plan.label}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {upgradeMessage && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {upgradeMessage}
          </p>
        )}
      </section>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function UsageCell({
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
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {used === null ? "∞" : used}
        {!isRemaining && (
          <span className="ml-1 text-sm font-normal text-slate-500">
            / {formatLimit(limit)}
          </span>
        )}
      </p>
    </div>
  );
}
