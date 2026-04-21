import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StartGeneratedAd } from "@/lib/types";

interface Props {
  index: number;
  ad: StartGeneratedAd;
}

export function GeneratedAdCard({ index, ad }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Вариант #{index + 1}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">{ad.headline}</p>
          {ad.headline2 && (
            <p className="text-sm text-slate-700">{ad.headline2}</p>
          )}
          <p className="text-sm text-slate-700 leading-relaxed">{ad.text}</p>
        </div>

        {ad.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ad.keywords.slice(0, 8).map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {ad.reasoning && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
            {ad.reasoning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
