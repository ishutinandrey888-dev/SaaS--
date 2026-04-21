import Link from "next/link";
import { CheckCircle2, Sparkles, Timer } from "lucide-react";
import { Upload } from "@/components/upload";

const bullets = [
  {
    icon: Timer,
    title: "Аудит за 60 секунд",
    text: "Проверяем каждое объявление по 8 правилам Директа.",
  },
  {
    icon: Sparkles,
    title: "AI-улучшение",
    text: "Переписываем слабые объявления с учётом ключевых фраз.",
  },
  {
    icon: CheckCircle2,
    title: "Готовый Excel",
    text: "Скачайте файл и загрузите обратно в Яндекс Директ.",
  },
];

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 py-16">
      <header className="flex w-full items-center justify-between">
        <div className="text-sm font-semibold tracking-tight text-slate-900">
          SaaS Direct
        </div>
        <nav className="flex items-center gap-4 text-xs text-slate-500">
          <Link href="/start" className="hover:text-slate-900">
            START (AI-конструктор)
          </Link>
          <Link href="/dashboard" className="hover:text-slate-900">
            Дашборд
          </Link>
          <span>MVP</span>
        </nav>
      </header>

      <section className="mt-20 flex flex-col items-center text-center">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
          AI-аудит рекламы в Яндекс Директ
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Улучшаем вашу рекламу —<br />
          экономим бюджет.
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-600">
          Загрузите Excel из Яндекс Директ и получите аудит каждого объявления
          с готовыми переписанными версиями — за 60 секунд.
        </p>

        <div className="mt-10 w-full flex justify-center">
          <Upload />
        </div>
      </section>

      <section className="mt-20 grid w-full gap-4 sm:grid-cols-3">
        {bullets.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/70 shadow-soft"
          >
            <Icon className="h-6 w-6 text-brand-600" />
            <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1.5 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-16 text-xs text-slate-400">
        Данные не сохраняются — мы анализируем файл и возвращаем результат.
      </footer>
    </main>
  );
}
