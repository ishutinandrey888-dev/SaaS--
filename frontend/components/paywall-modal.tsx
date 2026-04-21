"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthError, postUpgradeIntent } from "@/lib/api";
import type { Paywall } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  paywall: Paywall | null;
  onClose: () => void;
  onAuthError?: () => void;
}

export function PaywallModal({ paywall, onClose, onAuthError }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paywall) {
      setSubmitted(false);
      setError(null);
    }
  }, [paywall]);

  const onUpgrade = useCallback(async () => {
    if (!paywall) return;
    setSubmitting(true);
    setError(null);
    try {
      await postUpgradeIntent({
        plan: "starter",
        trigger: paywall.trigger,
      });
      setSubmitted(true);
    } catch (e) {
      if (e instanceof AuthError) {
        onAuthError?.();
        return;
      }
      setError("Не получилось записать интерес. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }, [paywall, onAuthError]);

  if (!paywall) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card",
          "ring-1 ring-slate-200/70",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
              Starter
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              {paywall.message}
            </h2>
            {paywall.upgrade_hint && (
              <p className="mt-2 text-sm text-slate-600">
                {paywall.upgrade_hint}
              </p>
            )}
          </div>
        </div>

        <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
          <li>· 20 загрузок в месяц</li>
          <li>· до 500 объявлений за раз</li>
          <li>· 50 AI-улучшений ежемесячно</li>
          <li>· история за 30 дней</li>
        </ul>

        {submitted ? (
          <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            Мы записали ваш интерес. Пришлём письмо, когда оплата
            откроется.
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <Button
              onClick={onUpgrade}
              disabled={submitting}
              size="lg"
              className="w-full"
            >
              {submitting ? "Отправляем…" : paywall.cta}
            </Button>
            <p className="text-center text-[11px] text-slate-400">
              Оплата скоро — пока фиксируем интерес.
            </p>
            {error && (
              <p className="text-center text-xs text-rose-600">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
