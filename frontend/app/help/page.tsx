import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-8 py-10">
        <header>
          <p className="text-xs uppercase tracking-wide text-ink-600">
            Центр помощи
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Поддержка</h1>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="https://t.me/dozim_ai"
            className="card block p-5 transition hover:bg-ink-200"
          >
            <p className="text-sm font-semibold">Telegram</p>
            <p className="mt-1 text-xs text-ink-600">Чат поддержки 9–22 МСК</p>
          </a>
          <a
            href="mailto:hello@dozim.ai"
            className="card block p-5 transition hover:bg-ink-200"
          >
            <p className="text-sm font-semibold">Email</p>
            <p className="mt-1 text-xs text-ink-600">hello@dozim.ai</p>
          </a>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Частые вопросы</h2>
          <div className="mt-4 space-y-4 text-sm text-ink-700">
            <Block title="Как подключить Яндекс Директ?">
              Нажмите «Подключить аккаунт» в разделе{" "}
              <Link href="/yandex" className="text-brand-500 hover:text-brand-600">
                Яндекс Директ
              </Link>{" "}
              и пройдите OAuth. В демо-режиме (без OAuth-приложения) подключение
              моментально создаёт фейковый аккаунт для теста.
            </Block>
            <Block title="Чем отличаются режимы агента?">
              Советник — только сообщает находки. Ассистент — предлагает
              действия, применение по кнопке. Автопилот — применяет находки с
              уверенностью ≥ 90% самостоятельно.
            </Block>
            <Block title="Что такое тарифы Pro и Agency?">
              Pro — 5 990 ₽/мес: 5 000 токенов на аудит, AI-рекомендации и
              генерацию изображений. Agency — 19 900 ₽/мес: 15 000 токенов,
              командный доступ, white-label отчёты и приоритетная поддержка.
            </Block>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-xs text-ink-600">{children}</p>
    </div>
  );
}
