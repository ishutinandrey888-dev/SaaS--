import { AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Insights, Summary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  summary: Summary;
  insights: Insights;
}

const CTR_COPY: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  low: { label: "Потерь почти нет", tone: "good" },
  "moderate (~10-20%)": { label: "Вы теряете до 20% бюджета", tone: "warn" },
  "high (~20-35%)": { label: "Вы теряете до 35% бюджета", tone: "bad" },
  "severe (>35%)": { label: "Вы теряете более 35% бюджета", tone: "bad" },
  "n/a": { label: "Недостаточно данных", tone: "warn" },
};

function ctrCopy(key: string) {
  return CTR_COPY[key] ?? { label: key, tone: "warn" as const };
}

function Metric({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  caption?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    neutral: "text-slate-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
  }[tone];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", toneClass)}>
        {value}
      </p>
      {caption && <p className="mt-1 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}

export function SummaryPanel({ summary, insights }: Props) {
  const ctr = ctrCopy(insights.estimated_ctr_loss);
  const avgTone: "neutral" | "good" | "warn" | "bad" =
    summary.avg_score >= 80 ? "good" : summary.avg_score >= 60 ? "warn" : "bad";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card
        className={cn(
          "md:col-span-2",
          ctr.tone === "bad" && "ring-rose-200",
          ctr.tone === "warn" && "ring-amber-200",
        )}
      >
        <CardContent className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              ctr.tone === "good" && "bg-emerald-50 text-emerald-600",
              ctr.tone === "warn" && "bg-amber-50 text-amber-600",
              ctr.tone === "bad" && "bg-rose-50 text-rose-600",
            )}
          >
            {ctr.tone === "good" ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Оценка по CTR
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {ctr.label}
            </p>
            <p className="mt-1.5 text-sm text-slate-500">
              {insights.weak_ads_percent}% объявлений — слабые (score &lt; 60).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <Metric
            label="Объявлений"
            value={summary.total_ads}
            caption={`${summary.total_campaigns} кампани${summary.total_campaigns === 1 ? "я" : "й"}`}
          />
          <Metric
            label="Средний score"
            value={summary.avg_score.toFixed(1)}
            caption={`Улучшено AI: ${summary.improved_count}`}
            tone={avgTone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
