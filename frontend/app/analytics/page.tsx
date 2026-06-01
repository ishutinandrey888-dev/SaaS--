import { AppShell } from "../../components/app-shell";

export default function AnalyticsPage() {
  return (
    <AppShell active="/analytics" title="Аналитика" subtitle="Сводка событий, лидов и рекламных гипотез. Полный модуль появится в P1.">
      <section className="placeholder-grid">
        <article className="panel dashboard-card">
          <h2>События</h2>
          <p>radar_* events</p>
          <span>Страница готова для подключения графиков и ретеншена.</span>
        </article>
      </section>
    </AppShell>
  );
}
