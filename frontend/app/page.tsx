import Link from "next/link";
import { Activity } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-white">
        <Activity className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">ДОЖИМ-АЙ</h1>
      <p className="mt-3 max-w-xl text-base text-ink-600">
        AI-агент следит за рекламой 24/7: аудитит, ищет точки роста, в
        автопилоте применяет изменения через API Яндекс Директа.
      </p>
      <div className="mt-10 flex gap-3">
        <Link href="/register" className="btn-primary">
          Начать бесплатно
        </Link>
        <Link href="/login" className="btn-secondary">
          Войти
        </Link>
      </div>
      <p className="mt-12 text-xs text-ink-600">
        FREE 7 дней · PRO 3 990 ₽/мес · AGENCY 13 900 ₽/мес
      </p>
    </main>
  );
}
