"use client";

import { useState, type KeyboardEvent } from "react";
import { X, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StartBrief, StartTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_OPTIONS: { id: StartTone; label: string }[] = [
  { id: "neutral", label: "Нейтральный" },
  { id: "friendly", label: "Дружелюбный" },
  { id: "confident", label: "Уверенный" },
  { id: "premium", label: "Премиальный" },
  { id: "playful", label: "Игривый" },
];

const COUNT_OPTIONS = [3, 5, 8, 10];

interface Props {
  onSubmit: (brief: StartBrief) => void;
  loading: boolean;
}

export function BriefForm({ onSubmit, loading }: Props) {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [region, setRegion] = useState("");
  const [tone, setTone] = useState<StartTone>("confident");
  const [count, setCount] = useState(5);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwDraft, setKwDraft] = useState("");

  const canSubmit =
    product.trim().length >= 2 &&
    audience.trim().length >= 2 &&
    region.trim().length >= 2 &&
    !loading;

  function addKeyword() {
    const value = kwDraft.trim();
    if (!value) return;
    if (keywords.includes(value)) {
      setKwDraft("");
      return;
    }
    if (keywords.length >= 20) return;
    setKeywords([...keywords, value]);
    setKwDraft("");
  }

  function onKwKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
  }

  function removeKeyword(value: string) {
    setKeywords(keywords.filter((k) => k !== value));
  }

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      product: product.trim(),
      audience: audience.trim(),
      region: region.trim(),
      keywords,
      tone,
      count,
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Продукт или услуга" hint="Что вы продвигаете.">
        <input
          type="text"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Онлайн-курс по Python для начинающих"
          className={inputCls}
          maxLength={200}
        />
      </Field>

      <Field label="Целевая аудитория" hint="Кому это нужно.">
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Разработчики 20-35, хотят сменить стек"
          className={inputCls}
          maxLength={300}
        />
      </Field>

      <Field label="Регион" hint="Где показывать объявления.">
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Москва и область"
          className={inputCls}
          maxLength={100}
        />
      </Field>

      <Field label="Ключевые фразы" hint="Enter или запятая, чтобы добавить.">
        <div className="space-y-2">
          <input
            type="text"
            value={kwDraft}
            onChange={(e) => setKwDraft(e.target.value)}
            onKeyDown={onKwKeyDown}
            onBlur={addKeyword}
            placeholder="курсы python"
            className={inputCls}
          />
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 ring-1 ring-brand-100"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-brand-900"
                    aria-label={`Удалить ${kw}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="Тональность">
        <div className="flex flex-wrap gap-1.5">
          {TONE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setTone(opt.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                tone === opt.id
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Сколько вариантов">
        <div className="flex gap-1.5">
          {COUNT_OPTIONS.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setCount(n)}
              className={cn(
                "h-10 w-12 rounded-xl text-sm font-medium transition",
                count === n
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Button type="submit" size="lg" disabled={!canSubmit}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Wand2 className="h-5 w-5" />
        )}
        {loading ? "Генерируем объявления…" : "Создать объявления"}
      </Button>
    </form>
  );
}

const inputCls =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
