"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApiError, AuthError, fetchDashboard } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";

function HistoryContent() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchDashboard();
        if (!cancelled) setHistory(d.history);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          router.push("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (history === null && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-600">История</p>
        <h1 className="mt-1 text-3xl font-semibold">Все запуски</h1>
      </header>

      {error && (
        <p className="mt-6 text-sm text-rose-400">{error}</p>
      )}

      <ul className="mt-8 space-y-3">
        {(history ?? []).map((h) => (
          <li key={h.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{h.agent_name}</p>
              <p className="text-xs text-ink-600">
                {new Date(h.started_at).toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="text-right text-xs text-ink-600">
              {h.findings} находок · {h.applied} применено
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryContent />
    </AppShell>
  );
}
