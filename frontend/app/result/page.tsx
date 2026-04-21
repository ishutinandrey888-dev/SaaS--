"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, TriangleAlert } from "lucide-react";
import { AdCard } from "@/components/ad-card";
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
} from "@/lib/types";

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

export default function ResultPage() {
  const router = useRouter();
  const [stored, setStored] = useState<Stored | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Stored;
      setStored(parsed);
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
        window.alert("Требуется вход. Переадресация на /login.");
        router.push("/login");
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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          К загрузке
        </Link>
        <span className="truncate text-xs text-slate-400">{filename}</span>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Результат аудита
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Мы проверили объявления и переписали самые слабые. Скачайте Excel
          и загрузите его обратно в Яндекс Директ.
        </p>
      </section>

      <section className="mt-8">
        <SummaryPanel summary={data.summary} insights={data.insights} />
      </section>

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
          <Button onClick={onDownload} disabled={downloading} size="lg">
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

      <footer className="mt-auto pt-16 text-xs text-slate-400">
        Данные не сохраняются — после обновления страницы результат теряется.
      </footer>
    </main>
  );
}
