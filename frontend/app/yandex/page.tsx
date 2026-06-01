import { AppShell } from "../../components/app-shell";

export default function YandexPage() {
  return (
    <AppShell active="/yandex" title="Яндекс" subtitle="Интеграции с Яндекс Директ, Wordstat и будущим мониторингом SERP.">
      <section className="placeholder-grid">
        <article className="panel dashboard-card">
          <h2>Подключение</h2>
          <p>Direct API</p>
          <span>Пока модуль в режиме дорожной карты.</span>
        </article>
      </section>
    </AppShell>
  );
}
