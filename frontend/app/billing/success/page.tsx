"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, AuthError, fetchPaymentStatus } from "@/lib/api";
import type { PaymentStatus, PaymentStatusResponse } from "@/lib/types";

type UiState =
  | { kind: "loading" }
  | { kind: "polling"; payment: PaymentStatusResponse }
  | { kind: "done"; payment: PaymentStatusResponse }
  | { kind: "failed"; payment: PaymentStatusResponse | null; message: string }
  | { kind: "missing" };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

function isTerminal(status: PaymentStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function planLabel(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  return plan;
}

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [state, setState] = useState<UiState>(
    id ? { kind: "loading" } : { kind: "missing" },
  );

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const startedAt = Date.now();

    async function poll() {
      if (!alive) return;
      try {
        const payment = await fetchPaymentStatus(id!);
        if (!alive) return;

        if (isTerminal(payment.status)) {
          setState(
            payment.status === "succeeded"
              ? { kind: "done", payment }
              : {
                  kind: "failed",
                  payment,
                  message:
                    payment.status === "canceled"
                      ? "Платёж отменён."
                      : "Платёж не прошёл.",
                },
          );
          return;
        }

        setState({ kind: "polling", payment });

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setState({
            kind: "failed",
            payment,
            message:
              "Превышено время ожидания. Обновите страницу позже или напишите в поддержку.",
          });
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (!alive) return;
        if (error instanceof AuthError) {
          router.push("/login");
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка: ${error.message}`
            : "Не удалось получить статус платежа.";
        setState({ kind: "failed", payment: null, message });
      }
    }

    poll();
    return () => {
      alive = false;
    };
  }, [id, router]);

  const goDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        В настройки
      </Link>

      <div className="mt-16 flex-1">
        {state.kind === "missing" && (
          <Card>
            <TriangleAlert className="h-10 w-10 text-amber-500" />
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">
              Параметр платежа не найден
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              В адресе страницы нет идентификатора платежа. Вернитесь на страницу
              настроек и попробуйте снова.
            </p>
            <div className="mt-6">
              <Link href="/settings">
                <Button>В настройки</Button>
              </Link>
            </div>
          </Card>
        )}

        {(state.kind === "loading" || state.kind === "polling") && (
          <Card>
            <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">
              Подтверждаем платёж…
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Обычно это занимает 5–30 секунд. Не закрывайте страницу.
            </p>
            {state.kind === "polling" && state.payment && (
              <p className="mt-3 text-xs text-slate-400">
                Тариф: {planLabel(state.payment.plan)} · {" "}
                {(state.payment.amount / 100).toLocaleString("ru-RU")}{" "}
                {state.payment.currency}
              </p>
            )}
          </Card>
        )}

        {state.kind === "done" && (
          <Card>
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">
              Тариф активирован
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Мы подтвердили платёж по тарифу{" "}
              <span className="font-semibold text-slate-900">
                {planLabel(state.payment.plan)}
              </span>
              . Новые лимиты уже доступны.
            </p>
            <div className="mt-6 flex gap-2">
              <Button onClick={goDashboard}>В дашборд</Button>
              <Link href="/settings">
                <Button variant="secondary">В настройки</Button>
              </Link>
            </div>
          </Card>
        )}

        {state.kind === "failed" && (
          <Card>
            <TriangleAlert className="h-10 w-10 text-rose-500" />
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">
              Не удалось завершить оплату
            </h1>
            <p className="mt-2 text-sm text-slate-600">{state.message}</p>
            <div className="mt-6 flex gap-2">
              <Link href="/settings">
                <Button>Попробовать ещё раз</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-8 ring-1 ring-slate-200/70 shadow-soft">
      {children}
    </div>
  );
}

export default function SuccessPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
