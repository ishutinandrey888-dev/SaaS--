"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { ApiError, AuthError, fetchPaymentStatus } from "@/lib/api";
import type { PaymentStatusResponse } from "@/lib/types";

type Status = PaymentStatusResponse["status"];

type UiState =
  | { kind: "loading" }
  | { kind: "polling"; payment: PaymentStatusResponse }
  | { kind: "done"; payment: PaymentStatusResponse }
  | { kind: "failed"; payment: PaymentStatusResponse | null; message: string }
  | { kind: "missing" };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

function isTerminal(status: Status): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function planLabel(plan: string): string {
  if (plan === "pro") return "Pro";
  if (plan === "agency") return "Agency";
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
      <Link href="/settings" className="text-sm text-ink-600 hover:text-ink-900">
        ← В настройки
      </Link>

      <div className="mt-12 flex-1">
        {state.kind === "missing" && (
          <Card>
            <TriangleAlert className="h-10 w-10 text-amber-400" />
            <h1 className="mt-5 text-2xl font-semibold">
              Параметр платежа не найден
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              В адресе страницы нет идентификатора платежа. Вернитесь в
              настройки и попробуйте снова.
            </p>
            <div className="mt-6">
              <Link href="/settings" className="btn-primary">
                В настройки
              </Link>
            </div>
          </Card>
        )}

        {(state.kind === "loading" || state.kind === "polling") && (
          <Card>
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <h1 className="mt-5 text-2xl font-semibold">
              Подтверждаем платёж…
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              Обычно 5–30 секунд. Не закрывайте страницу.
            </p>
            {state.kind === "polling" && state.payment && (
              <p className="mt-3 text-xs text-ink-600">
                Тариф: {planLabel(state.payment.plan)} ·{" "}
                {(state.payment.amount / 100).toLocaleString("ru-RU")}{" "}
                {state.payment.currency}
              </p>
            )}
          </Card>
        )}

        {state.kind === "done" && (
          <Card>
            <CheckCircle2 className="h-10 w-10 text-brand-500" />
            <h1 className="mt-5 text-2xl font-semibold">Тариф активирован</h1>
            <p className="mt-2 text-sm text-ink-600">
              Мы подтвердили платёж по тарифу{" "}
              <span className="font-semibold">
                {planLabel(state.payment.plan)}
              </span>
              . Новые лимиты уже доступны.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={goDashboard}
                className="btn-primary"
              >
                В дашборд
              </button>
              <Link href="/settings" className="btn-secondary">
                В настройки
              </Link>
            </div>
          </Card>
        )}

        {state.kind === "failed" && (
          <Card>
            <TriangleAlert className="h-10 w-10 text-rose-400" />
            <h1 className="mt-5 text-2xl font-semibold">
              Не удалось завершить оплату
            </h1>
            <p className="mt-2 text-sm text-ink-600">{state.message}</p>
            <div className="mt-6 flex gap-2">
              <Link href="/settings" className="btn-primary">
                Попробовать ещё раз
              </Link>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card p-8">{children}</div>;
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
