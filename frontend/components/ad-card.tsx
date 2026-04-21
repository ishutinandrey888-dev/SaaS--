import { ArrowRight, CircleAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdResult } from "@/lib/types";
import { cn, scoreTone } from "@/lib/utils";

interface Props {
  index: number;
  ad: AdResult;
}

const ISSUE_COPY: Record<string, string> = {
  headline_empty: "Пустой заголовок",
  headline_too_long: "Заголовок длиннее лимита",
  headline_too_short: "Слишком короткий заголовок",
  headline2_too_long: "Второй заголовок длиннее лимита",
  text_empty: "Пустой текст",
  text_too_long: "Текст длиннее лимита",
  text_too_short: "Слишком короткий текст",
  keyword_not_in_headline: "Ключ не вставлен в заголовок",
  no_cta: "Нет призыва к действию",
  no_specifics: "Нет конкретики (цен, сроков, цифр)",
  too_much_uppercase: "Слишком много КАПСА",
  too_many_exclamations: "Перебор с восклицаниями",
};

function issueLabel(key: string) {
  return ISSUE_COPY[key] ?? key;
}

export function AdCard({ index, ad }: Props) {
  const tone = scoreTone(ad.audit.score);
  const hasImproved = ad.improved !== null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              #{index + 1} · {ad.original.campaign || "без кампании"}
              {ad.original.group ? ` · ${ad.original.group}` : ""}
            </p>
          </div>
          <Badge tone={tone}>Score {ad.audit.score}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Было
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {ad.original.headline || "—"}
            </p>
            <p className="text-sm text-slate-600">{ad.original.text || "—"}</p>
          </div>

          <div className="flex items-center justify-center md:px-1">
            <ArrowRight
              className={cn(
                "h-5 w-5 text-slate-300",
                hasImproved && "text-brand-500",
              )}
            />
          </div>

          <div
            className={cn(
              "space-y-2 rounded-xl p-4 ring-1",
              hasImproved
                ? "bg-brand-50/60 ring-brand-100"
                : "bg-slate-50 ring-slate-100",
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              Стало
            </p>
            {hasImproved ? (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {ad.improved!.headline}
                </p>
                <p className="text-sm text-slate-700">{ad.improved!.text}</p>
                {ad.improved!.reasoning && (
                  <p className="pt-1 text-xs text-slate-500">
                    {ad.improved!.reasoning}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm italic text-slate-500">
                Не удалось улучшить.
              </p>
            )}
          </div>
        </div>

        {ad.audit.issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ad.audit.issues.map((issue) => (
              <span
                key={issue}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700 ring-1 ring-rose-100"
              >
                <CircleAlert className="h-3 w-3" />
                {issueLabel(issue)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
