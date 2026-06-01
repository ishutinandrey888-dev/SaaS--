"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";

type StoredUser = {
  name: string;
  email: string;
  role: string;
};

type StoredProject = {
  name: string;
  region: string;
};

const productCards = [
  {
    title: "AI-аналитик",
    text: "Разбор офферов, слабых мест и гипотез для рекламных связок.",
    href: "/analytics",
    status: "Скоро"
  },
  {
    title: "Яндекс Директ",
    text: "Подключение кампаний, ключей, минус-слов и рекомендаций.",
    href: "/yandex",
    status: "Интеграция"
  },
  {
    title: "История",
    text: "Сохраненные аудиты, лиды и конкурентные срезы по проектам.",
    href: "/lead-magnet",
    status: "MVP"
  },
  {
    title: "Настройки",
    text: "Профиль, уведомления, доступы, legal-согласия и лимиты.",
    href: "/settings",
    status: "База"
  }
];

const nextSteps = [
  "Запустить Радар конкурентов по основной нише.",
  "Оставить Telegram или email для полного AI-аудита.",
  "Подключить Яндекс Директ и историю проверок в следующем этапе."
];

export default function DashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [project, setProject] = useState<StoredProject | null>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem("dozhimUser");
    const storedProject = window.localStorage.getItem("dozhimProject");
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedProject) setProject(JSON.parse(storedProject));
  }, []);

  return (
    <AppShell
      active="/dashboard"
      title={`Здравствуйте${user ? `, ${user.name}` : ""}`}
      subtitle="Ваш кабинет ДОЖИМ-АЙ: быстрый старт аудита, AI-рекомендации, Яндекс-интеграции и история конкурентных проверок."
    >
      <section className="user-dashboard-hero panel">
        <div>
          <span className="dashboard-kicker">Главный инструмент</span>
          <h2>Радар конкурентов</h2>
          <p>Запустите быстрый аудит ниши: конкуренты, офферы, слабые места и 3-5 идей для своей рекламы.</p>
        </div>
        <Link className="primary-button" href="/lead-magnet">
          Запустить аудит
        </Link>
      </section>

      <section className="dashboard-grid">
        {productCards.map((card) => (
          <Link className="panel dashboard-card dashboard-module-card" href={card.href} key={card.title}>
            <span className="module-status">{card.status}</span>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </Link>
        ))}
      </section>

      <section className="dashboard-grid dashboard-secondary-grid">
        <article className="panel dashboard-card">
          <h2>Профиль</h2>
          <p>{user ? user.name : "Гость"}</p>
          <span>{user ? user.email : "После регистрации данные появятся здесь."}</span>
        </article>
        <article className="panel dashboard-card">
          <h2>Проект</h2>
          <p>{project ? project.name : "Первый проект"}</p>
          <span>{project ? project.region : "Москва"}</span>
        </article>
        <article className="panel dashboard-card dashboard-next-card">
          <h2>Следующие шаги</h2>
          <ol>
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="quick-links">
        <Link href="/lead-magnet">Lead-magnet</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/yandex">Yandex</Link>
        <Link href="/admin">Admin-раздел</Link>
      </section>
    </AppShell>
  );
}
