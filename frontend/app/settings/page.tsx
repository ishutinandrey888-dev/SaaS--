import { AppShell } from "../../components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell active="/settings" title="Настройки" subtitle="Рабочее пространство, доступы, уведомления и legal-настройки.">
      <section className="placeholder-grid">
        <article className="panel dashboard-card">
          <h2>Workspace</h2>
          <p>ДОЖИМ-АЙ</p>
          <span>Здесь будут роли, лимиты, интеграции и согласия.</span>
        </article>
      </section>
    </AppShell>
  );
}
