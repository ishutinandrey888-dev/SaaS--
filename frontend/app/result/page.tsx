"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { AdCard } from "@/components/ad-card";
import { PaywallModal } from "@/components/paywall-modal";
import { SummaryPanel } from "@/components/summary";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  AuthError,
  downloadBlob,
  exportExcel,
} from "@/lib/api";
import type {
  AdForExport,
  AdResult,
  ExcelUploadResponse,
  Paywall,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 20;
const STORAGE_KEY = "excel_result";

type Stored = {
  data: ExcelUploadResponse;
  filename: string;
  at: number;
};

function toExportAd(ad: AdResult): AdForExport {
  const source = ad.improved;
  return {
    campaign: ad.original.campaign,
    group: ad.original.group,
    headline: source ? source.headline : ad.original.headline,
    headline2: ad.original.headline2,
    text: source ? source.text : ad.original.text,
    keywords: ad.original.keywords,
  };
}

function stripExt(name: string): string {
  return name.replace(/\.(xlsx|xlsm)$/i, "");
}

function LimitsBar({
  data,
}: {
  data: ExcelUploadResponse;
}) {
  const { plan, limits, usage } = data;
  const aiTotal = limits.ai_ads;
  const aiUsed = usage.ai_ads_used;
  const uploadsTotal = limits.uploads;
  const uploadsUsed = usage.uploads_used;

  const aiPct =
    aiTotal == null
      ? null
      : Math.min(100, Math.round((aiUsed / aiTotal) * 100));
  const upPct =
    uploadsTotal == null
      ? null
      : Math.min(100, Math.round((uploadsUsed / uploadsTotal) * 100));

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white px-5 py-3 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
          {plan}
        </span>
        {limits.watermark && (
          <span className="inline-flex items-center gap-1 text-[11px] text-brand-700">
            <Sparkles className="h-3 w-3" />
            AI powered
          </span>
        )}
      </div>
      {upPct != null && (
        <QuotaBar
          label="Загрузки"
          used={uploadsUsed}
          total={uploadsTotal ?? 0}
          percent={upPct}
        />
      )}
      {aiPct != null && (
        <QuotaBar
          label="AI-улучшения"
          used={aiUsed}
          total={aiTotal ?? 0}
          percent={aiPct}
        />
      )}
    </div>
  );
}

function QuotaBar({
  label,
  used,
  total,
  percent,
}: {
  label: string;
  used: number;
  total: number;
  percent: number;
}) {
  const tone = percent >= 100 ? "bad" : percent >= 75 ? "warn" : "good";
  return (
    <div className="min-w-[160px] flex-1">
      <div className="flex items-baseline justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">
          {used}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "good" && "bg-brand-500",
            tone === "warn" && "bg-amber-500",
            tone === "bad" && "bg-rose-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [stored, setStored] = useState<Stored | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<Paywall | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Stored;
      setStored(parsed);
      if (parsed.data.paywall) {
        setPaywall(parsed.data.paywall);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      router.replace("/");
      return;
    }
    setHydrated(true);
  }, [router]);

  const sortedAds = useMemo(() => {
    if (!stored) return [];
    return [...stored.data.ads].sort(
      (a, b) => a.audit.score - b.audit.score,
    );
  }, [stored]);

  const visibleAds = sortedAds.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, sortedAds.length - MAX_VISIBLE);

  const onAuthError = useCallback(() => {
    window.alert("Требуется вход. Переадресация на /login.");
    router.push("/login");
  }, [router]);

  if (!hydrated || !stored) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  const { data, filename } = stored;
  const baseName = stripExt(filename) || "improved_ads";
  const downloadName = `${baseName}-improved.xlsx`;

  const onDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const blob = await exportExcel({
        ads: data.ads.map(toExportAd),
        filename: `${baseName}-improved`,
      });
      downloadBlob(blob, downloadName);
    } catch (error) {
      if (error instanceof AuthError) {
        onAuthError();
        return;
      }
      const message =
        error instanceof ApiError
          ? `Ошибка сервера: ${error.message}`
          : "Не удалось подготовить файл. Попробуйте ещё раз.";
      setDownloadError(message);
    } finally {
      setDownloading(false);
    }
  };

  const quotaBlocked = data.paywall?.trigger === "on_upload_exhausted";

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            К загрузке
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Дашборд
            </Link>
            <span className="truncate text-xs text-slate-400">{filename}</span>
          </div>
        </header>

        <section className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {quotaBlocked ? "Лимит загрузок исчерпан" : "Результат аудита"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {quotaBlocked
              ? "Бесплатные загрузки на этот месяц закончились — оформите Starter, чтобы продолжить."
              : "Мы проверили объявления и переписали самые слабые. Скачайте Excel и загрузите его обратно в Яндекс Директ."}
          </p>
        </section>

        <section className="mt-6">
          <LimitsBar data={data} />
        </section>

        {!quotaBlocked && (
          <section className="mt-6">
            <SummaryPanel summary={data.summary} insights={data.insights} />
          </section>
        )}

        {data.paywall?.upgrade_hint && !quotaBlocked && (
          <section className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-50/70 px-5 py-4 ring-1 ring-brand-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <div className="min-w-0">
              <p className="text-sm text-slate-800">
                {data.paywall.upgrade_hint}
              </p>
              <button
                type="button"
                onClick={() => setPaywall(data.paywall)}
                className="mt-1 text-sm font-medium text-brand-700 hover:text-brand-900"
              >
                {data.paywall.cta} →
              </button>
            </div>
          </section>
        )}

        {!quotaBlocked && (
          <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-soft">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Готовый файл для Директа
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.summary.improved_count > 0
                  ? `В файле ${data.summary.improved_count} переписанных объявлений.`
                  : "AI-улучшения не применялись, файл содержит исходные объявления."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button
                onClick={onDownload}
                disabled={downloading || data.ads.length === 0}
                size="lg"
              >
                {downloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {downloading ? "Готовим файл…" : "Скачать Excel"}
              </Button>
              {downloadError && (
                <span className="text-xs text-rose-600">{downloadError}</span>
              )}
            </div>
          </section>
        )}

        {data.errors.length > 0 && (
          <section className="mt-6 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
            <div className="flex items-center gap-2 text-amber-900">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm font-semibold">
                Пропущены строки ({data.errors.length})
              </p>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-amber-900/90">
              {data.errors.slice(0, 8).map((err, i) => (
                <li key={`${err.row}-${err.field}-${i}`}>
                  Строка {err.row} · {err.field}: {err.message}
                </li>
              ))}
              {data.errors.length > 8 && (
                <li className="text-amber-800/70">
                  …и ещё {data.errors.length - 8}.
                </li>
              )}
            </ul>
          </section>
        )}

        {!quotaBlocked && (
          <section className="mt-8 space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Объявления
              </h2>
              <span className="text-xs text-slate-500">
                Показано {visibleAds.length} из {sortedAds.length}
              </span>
            </div>

            {visibleAds.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                В файле не нашлось объявлений для анализа.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleAds.map((ad, i) => (
                  <AdCard key={`${ad.original.row}-${i}`} index={i} ad={ad} />
                ))}
              </div>
            )}

            {overflow > 0 && (
              <p className="pt-2 text-center text-xs text-slate-500">
                …и ещё {overflow} объявлени{overflow === 1 ? "е" : "й"}. Они
                попадут в скачанный Excel.
              </p>
            )}
          </section>
        )}

        {quotaBlocked && data.paywall && (
          <section className="mt-8">
            <Button onClick={() => setPaywall(data.paywall)} size="lg">
              {data.paywall.cta}
            </Button>
          </section>
        )}

        <footer className="mt-auto pt-16 text-xs text-slate-400">
          Данные не сохраняются — после обновления страницы результат
          теряется.
        </footer>
      </main>

      <PaywallModal
        paywall={paywall}
        onClose={() => setPaywall(null)}
        onAuthError={onAuthError}
      />
    </>
  );
}
