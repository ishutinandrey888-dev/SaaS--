"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, AuthError, uploadExcelViaJob } from "@/lib/api";
import type { JobState } from "@/lib/types";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "loading"; job: JobState }
  | { kind: "error"; message: string };

const JOB_COPY: Record<JobState, string> = {
  queued: "Файл в очереди…",
  running: "Анализируем объявления…",
  done: "Готово",
  failed: "Ошибка обработки",
};

const ACCEPTED_EXT = [".xlsx", ".xlsm"];
const MAX_MB = 10;

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXT.some((ext) => name.endsWith(ext))) {
    return "Поддерживаются только .xlsx и .xlsm файлы.";
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `Файл больше ${MAX_MB} МБ — сократите выгрузку.`;
  }
  return null;
}

export function Upload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  const onFile = useCallback(
    async (file: File) => {
      const problem = validateFile(file);
      if (problem) {
        setState({ kind: "error", message: problem });
        return;
      }
      setState({ kind: "loading", job: "queued" });
      try {
        const data = await uploadExcelViaJob(file, (job) => {
          setState({ kind: "loading", job });
        });
        sessionStorage.setItem(
          "excel_result",
          JSON.stringify({ data, filename: file.name, at: Date.now() }),
        );
        router.push("/result");
      } catch (error) {
        if (error instanceof AuthError) {
          setState({ kind: "error", message: "Нужна авторизация." });
          window.alert("Требуется вход. Переадресация на /login.");
          router.push("/login");
          return;
        }
        const message =
          error instanceof ApiError
            ? `Ошибка сервера: ${error.message}`
            : "Не удалось загрузить файл. Попробуйте ещё раз.";
        setState({ kind: "error", message });
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void onFile(file);
    },
    [onFile],
  );

  const isLoading = state.kind === "loading";
  const loadingLabel =
    state.kind === "loading" ? JOB_COPY[state.job] : "";

  return (
    <div className="w-full max-w-2xl">
      <label
        htmlFor="excel-input"
        onDragOver={(e) => {
          e.preventDefault();
          if (!isLoading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={isLoading ? undefined : onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed bg-white px-8 py-16 text-center transition",
          "cursor-pointer shadow-soft",
          isDragging
            ? "border-brand-500 bg-brand-50/60"
            : "border-slate-200 hover:border-brand-400 hover:bg-slate-50",
          isLoading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          id="excel-input"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={isLoading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />

        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl",
            isDragging ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </span>

        <div className="space-y-1.5">
          <p className="text-lg font-medium text-slate-900">
            {isLoading
              ? loadingLabel
              : "Перетащите Excel сюда или нажмите, чтобы выбрать"}
          </p>
          <p className="text-sm text-slate-500">
            Файл выгрузки Яндекс Директа, до {MAX_MB} МБ. Формат .xlsx
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={isLoading}
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.click();
          }}
        >
          <FileSpreadsheet className="h-5 w-5" />
          {isLoading ? loadingLabel : "Загрузить Excel"}
        </Button>
      </label>

      {state.kind === "error" && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.message}
        </p>
      )}
    </div>
  );
}
