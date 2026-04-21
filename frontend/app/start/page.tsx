"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Sparkles } from "lucide-react";
import { BriefForm } from "@/components/start/brief-form";
import { GeneratedAdCard } from "@/components/start/generated-ad-card";
import { PaywallModal } from "@/components/paywall-modal";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  AuthError,
  downloadBlob,
  exportExcel,
  generateStartAds,
} from "@/lib/api";
import type {
  AdForExport,
  Paywall,
  StartBrief,
  StartGenerateResponse,
  StartGeneratedAd,
} from "@/lib/types";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

function toExportAd(ad: StartGeneratedAd, brief: StartBrief): AdForExport {
  return {
    campaign: brief.product.slice(0, 80),
    group: "START",
    headline: ad.headline,
    headline2: ad.headline2,
    text: ad.text,
    keywords: ad.keywords.length > 0 ? ad.keywords : brief.keywords,
  };
}

export default function StartPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [result, setResult] = useState<StartGenerateResponse | null>(null);
  const [brief, setBrief] = useState<StartBrief | null>(null);
  const [paywall, setPaywall] = useState<Paywall | null>(null);
  const [exporting, setExporting] = useState(false);

  const onGenerate = useCallback(async (next: StartBrief) => {
    setStatus({ kind: "loading" });
    try {
      const response = await generateStartAds(next);
      setResult(response);
      setBrief(next);
      if (response.paywall) setPaywall(response.paywall);
      setStatus({ kind: "idle" });
    } catch (error) {
      if (error instanceof AuthError) {
        setStatus({ kind: "error", message: "Нужна авторизация." });
        router.push("/login");
        return;
      }
      const message =
        error instanceof ApiError
          ? `Ошибка сервера: ${error.message}`
          : "Не удалось сгенерировать объявления. Попробуйте ещё раз.";
      setStatus({ kind: "error", message });
    }
  }, [router]);

  const onExport = useCallback(async () => {
    if (!result || !brief || result.ads.length === 0) return;
    setExporting(true);
    try {
      const ads = result.ads.map((ad) => toExportAd(ad, brief));
      const blob = await exportExcel({
        ads,
        filename: brief.product.slice(0, 60),
      });
      downloadBlob(blob, `start-${Date.now()}.xlsx`);
    } catch (error) {
      if (error instanceof AuthError) {
        router.push("/login");
        return;
      }
      const message =
        error instanceof ApiError
          ? `Не удалось скачать: ${error.message}`
          : "Не удалось скачать файл.";
      window.alert(message);
    } finally {
      setExporting(false);
    }
  }, [result, brief, router]);

  const isLoading = status.kind === "loading";
  const hasAds = !!result && result.ads.length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
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

      <section className="mt-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
          <Sparkles className="h-3.5 w-3.5" />
          START · AI-конструктор
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Создаём объявления из брифа
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          Опишите продукт, аудиторию и регион — AI сгенерирует готовые
          варианты для Яндекс Директа. Скачайте XLSX и загрузите в Мастер
          кампаний.
        </p>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 shadow-soft">
          <BriefForm onSubmit={onGenerate} loading={isLoading} />
          {status.kind === "error" && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {status.message}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {!result && !isLoading && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-4 text-sm font-medium text-slate-700">
                Заполните бриф слева, и здесь появятся варианты.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Каждый сгенерированный вариант списывается с AI-лимита тарифа.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              <p className="text-sm text-slate-600">
                Генерируем варианты… обычно занимает 10–30 секунд.
              </p>
            </div>
          )}

          {result && !isLoading && (
            <>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-600">
                  Сгенерировано{" "}
                  <span className="font-semibold text-slate-900">
                    {result.generated_count}
                  </span>{" "}
                  из {result.requested_count}.
                  {typeof result.usage.ai_ads_remaining === "number" && (
                    <>
                      {" "}Осталось AI-улучшений:{" "}
                      <span className="font-semibold text-slate-900">
                        {result.usage.ai_ads_remaining}
                      </span>
                    </>
                  )}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!hasAds || exporting}
                  onClick={onExport}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Скачать XLSX
                </Button>
              </div>

              {!hasAds && (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                  AI не вернул варианты. Попробуйте переформулировать бриф
                  или указать больше ключевых фраз.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {result.ads.map((ad, i) => (
                  <GeneratedAdCard key={i} index={i} ad={ad} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <PaywallModal paywall={paywall} onClose={() => setPaywall(null)} />
    </main>
  );
}
