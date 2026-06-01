import { AppShell } from "../../components/app-shell";

const metrics = [
  { label: "MRR", value: "842 000 ₽", delta: "+18%" },
  { label: "Лиды", value: "1 248", delta: "+31%" },
  { label: "Конверсия", value: "12,4%", delta: "+2,1 п.п." },
  { label: "CAC", value: "1 930 ₽", delta: "-9%" }
];

const users = [
  { name: "Алексей Морозов", plan: "Agency", status: "Активен", revenue: "98 000 ₽" },
  { name: "Мария Соколова", plan: "Pro", status: "Trial", revenue: "0 ₽" },
  { name: "Илья Громов", plan: "Business", status: "Активен", revenue: "44 000 ₽" }
];

const employees = [
  { name: "Ольга", role: "Sales", load: "74%" },
  { name: "Денис", role: "Customer Success", load: "58%" },
  { name: "Никита", role: "Performance", load: "82%" }
];

const sources = [
  { source: "Telegram", leads: 432, cpl: "760 ₽" },
  { source: "Wordstat", leads: 318, cpl: "410 ₽" },
  { source: "Яндекс Поиск", leads: 287, cpl: "980 ₽" },
  { source: "YouTube", leads: 211, cpl: "1 240 ₽" }
];

const utm = [
  { campaign: "radar_free_audit", medium: "telegram", cr: "15,2%" },
  { campaign: "wordstat_extension", medium: "organic", cr: "9,8%" },
  { campaign: "direct_competitors", medium: "cpc", cr: "11,4%" }
];

const funnel = [
  { step: "Визит", value: 12840 },
  { step: "Запуск радара", value: 3910 },
  { step: "Лид", value: 1248 },
  { step: "Демо", value: 284 },
  { step: "Оплата", value: 91 }
];

const mailings = [
  { name: "5 идей после Радара", status: "Идет", open: "48%" },
  { name: "Возврат к аудиту", status: "Пауза", open: "39%" },
  { name: "Tripwire-разбор", status: "Идет", open: "44%" }
];

const billing = [
  { plan: "Pro", accounts: 42, mrr: "336 000 ₽" },
  { plan: "Business", accounts: 18, mrr: "396 000 ₽" },
  { plan: "Agency", accounts: 5, mrr: "110 000 ₽" }
];

export default function AdminPage() {
  return (
    <AppShell
      active="/admin"
      title="Админ-панель"
      subtitle="Операционный центр лидов, воронок, сотрудников, UTM и выручки ДОЖИМ-АЙ."
    >
      <section className="admin-metrics">
        {metrics.map((metric) => (
          <article className="panel metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.delta}</em>
          </article>
        ))}
      </section>

      <section className="admin-grid">
        <article className="panel admin-card admin-card-wide">
          <div className="card-head">
            <h2>Пользователи</h2>
            <span>CRM snapshot</span>
          </div>
          <div className="admin-table">
            {users.map((user) => (
              <div className="admin-row" key={user.name}>
                <strong>{user.name}</strong>
                <span>{user.plan}</span>
                <span>{user.status}</span>
                <b>{user.revenue}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-card">
          <div className="card-head">
            <h2>Сотрудники</h2>
            <span>Нагрузка</span>
          </div>
          {employees.map((employee) => (
            <div className="staff-line" key={employee.name}>
              <div>
                <strong>{employee.name}</strong>
                <span>{employee.role}</span>
              </div>
              <b>{employee.load}</b>
            </div>
          ))}
        </article>

        <article className="panel admin-card">
          <div className="card-head">
            <h2>Источники</h2>
            <span>CPL</span>
          </div>
          {sources.map((item) => (
            <div className="source-line" key={item.source}>
              <strong>{item.source}</strong>
              <span>{item.leads} лидов</span>
              <b>{item.cpl}</b>
            </div>
          ))}
        </article>

        <article className="panel admin-card">
          <div className="card-head">
            <h2>UTM</h2>
            <span>Конверсия</span>
          </div>
          {utm.map((item) => (
            <div className="utm-line" key={item.campaign}>
              <strong>{item.campaign}</strong>
              <span>{item.medium}</span>
              <b>{item.cr}</b>
            </div>
          ))}
        </article>

        <article className="panel admin-card admin-card-wide">
          <div className="card-head">
            <h2>Воронка</h2>
            <span>Lead to paid</span>
          </div>
          <div className="funnel-track">
            {funnel.map((item, index) => (
              <div className="funnel-step" key={item.step} style={{ "--level": `${100 - index * 15}%` } as React.CSSProperties}>
                <span>{item.step}</span>
                <strong>{item.value.toLocaleString("ru-RU")}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-card">
          <div className="card-head">
            <h2>Рассылки</h2>
            <span>Open rate</span>
          </div>
          {mailings.map((item) => (
            <div className="mail-line" key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.status}</span>
              <b>{item.open}</b>
            </div>
          ))}
        </article>

        <article className="panel admin-card">
          <div className="card-head">
            <h2>Биллинг</h2>
            <span>MRR</span>
          </div>
          {billing.map((item) => (
            <div className="billing-line" key={item.plan}>
              <strong>{item.plan}</strong>
              <span>{item.accounts} аккаунтов</span>
              <b>{item.mrr}</b>
            </div>
          ))}
        </article>
      </section>
    </AppShell>
  );
}
