import { Lightbulb, TrendingDown, TrendingUp, AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignAnalytics, CampaignTone } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  campaigns: CampaignAnalytics[];
}

const TONE_RING: Record<CampaignTone, string> = {
  good: "ring-emerald-200",
  warn: "ring-amber-200",
  bad: "ring-rose-200",
};

const TONE_BADGE: Record<CampaignTone, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
};

const TONE_ICON: Record<CampaignTone, React.ComponentType<{ className?: string }>> = {
  good: TrendingUp,
  warn: TrendingDown,
  bad: AlertOctagon,
};

const TONE_LABEL: Record<CampaignTone, string> = {
  good: "В хорошей форме",
  warn: "Требует внимания",
  bad: "Срочно переделать",
};

function pluralAds(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "объявление";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "объявления";
  return "объявлений";
}

function CampaignCard({ campaign }: { campaign: CampaignAnalytics }) {
  const Icon = TONE_ICON[campaign.tone];
  return (
    <Card className={cn("ring-1", TONE_RING[campaign.tone])}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  TONE_BADGE[campaign.tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="truncate text-base font-semibold text-slate-900">
                {campaign.name}
              </h3>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {campaign.ads_count} {pluralAds(campaign.ads_count)}
              {campaign.groups.length > 0 &&
                ` · ${campaign.groups.length} групп${
                  campaign.groups.length === 1 ? "а" : ""
                }`}
              {campaign.improved_count > 0 &&
                ` · улучшено AI: ${campaign.improved_count}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                TONE_BADGE[campaign.tone],
              )}
            >
              {TONE_LABEL[campaign.tone]}
            </span>
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {campaign.avg_score.toFixed(1)}
            </p>
            <p className="text-[11px] text-slate-500">
              слабых: {campaign.weak_ads_percent}%
            </p>
          </div>
        </div>

        {campaign.top_issues.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Главные проблемы
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {campaign.top_issues.map((issue) => (
                <span
                  key={issue.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                >
                  {issue.label}
                  <span className="text-slate-500">×{issue.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {campaign.recommendations.length > 0 && (
          <div className="rounded-xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
            <div className="flex items-center gap-2 text-brand-800">
              <Lightbulb className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">
                Что делать
              </p>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
              {campaign.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CampaignAnalyticsList({ campaigns }: Props) {
  if (campaigns.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Аналитика по кампаниям
        </h2>
        <span className="text-xs text-slate-500">
          Худшие — сверху
        </span>
      </div>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.name} campaign={c} />
        ))}
      </div>
    </div>
  );
}
