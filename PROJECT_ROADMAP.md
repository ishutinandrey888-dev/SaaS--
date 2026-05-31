# PROJECT_ROADMAP.md

# Roadmap проекта ДОЖИМ-АЙ

Дата подготовки: 2026-05-31

Источник:
- Google Sheets checklist: `1rFRL6N3Iw1ZpjuziVKHjjo25KZQ7swEz`.
- Локальный аудит проекта: `PROJECT_AUDIT.md`.
- Фактическое состояние репозитория ДОЖИМ-АЙ.

Примечание: в исходном чек-листе почти все задачи отмечены как `Ожидание`.
В этом документе статус нормализован по фактическому состоянию кода и
документации:

- `Done` — реализовано в репозитории или документировано достаточно для MVP.
- `Partial` — основа есть, но требуется hardening, интеграция или production-настройка.
- `Todo` — нужно сделать.
- `Blocked` — нельзя закрыть без внешнего решения, юридического действия, провайдера или доступа.

## 1. Сводка по блокам

| Block | Current State | MVP Risk |
| --- | --- | --- |
| Product | Есть сильная витрина, onboarding и core flow частично собраны | Нет узкого production MVP и real first audit flow |
| Frontend | Лендинг, auth, admin, product routes, conversion pages готовы частично | Lead forms не пишут данные в backend |
| Backend | FastAPI, auth, billing, Yandex OAuth, agents, admin ops, RLS-aware DB есть | Multi-tenant/agency и prod guardrails не закрыты |
| AI | Есть agent runner, deterministic findings, OpenAI service skeleton | Недостаточно real AI-аудита и cost accounting по tenant |
| Marketing | Лендинг, quiz, ROI, lead magnet, tripwire, exit-intent есть | Нет lead delivery, CRM follow-up, аналитики воронки |
| Security | Auth, JWT, rate limits, token encryption, RLS foundation есть | CSRF, demo gating, Edge Functions hardening, dependency audit |
| Compliance | Legal pages и cookie banner есть | Документы шаблонные, нет consent log, 152-ФЗ контур не подтвержден |
| Infrastructure | Docker/deploy docs/nginx есть | Нет verified production deploy, monitoring, backups, restore drill |
| Analytics | Admin funnel metrics и UTM Supabase draft есть | Нет PostHog/Metrika event map и trustworthy funnel tracking |
| Billing | Robokassa skeleton, plans, token balance есть | Stub mode, no receipts/closing docs/recurrent flow |
| Agency Mode | Admin pages и payroll/CRM draft есть | Нет tenant/client/membership model |

## 2. Master Task Table

Структура подходит для импорта в Google Sheets или Notion. Колонки:
`Block`, `Task`, `Priority`, `Status`, `Complexity`, `Impact`,
`MVP Required`, `Milestone`, `Source`.

| Block | Task | Priority | Status | Complexity | Impact | MVP Required | Milestone | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product | Зафиксировать узкий MVP: Yandex Direct audit + lead capture + paid plan | P0 | Todo | M | High | Yes | До первого демо | Added |
| Product | Описать ICP: собственник малого бизнеса, директолог, агентство | P0 | Partial | S | High | Yes | До первого демо | Added |
| Product | Описать one-liner offer и promise без завышенных гарантий | P0 | Partial | S | High | Yes | До первого демо | Added |
| Product | Собрать activation flow: регистрация -> проект -> Yandex OAuth -> первый аудит | P0 | Partial | L | High | Yes | До первого клиента | Added |
| Product | Настроить demo mode с безопасными тестовыми данными | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Product | Реализовать product tour / onboarding wizard | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Product | Empty states с CTA для dashboard, agents, billing, yandex | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Product | A/B testing для landing/CTA/quiz | P2 | Todo | M | Medium | No | До 100 клиентов | Checklist |
| Product | Feature flags для risky features | P2 | Todo | M | Medium | No | До 100 клиентов | Checklist |
| Product | NPS/feedback loop после первого аудита | P1 | Partial | S | Medium | No | До 10 клиентов | Checklist |
| Frontend | Главный лендинг ДОЖИМ-АЙ | P0 | Done | M | High | Yes | До первого демо | Repo |
| Frontend | Quiz page и quiz popup | P0 | Done | M | High | Yes | До первого демо | Repo |
| Frontend | ROI-калькулятор окупаемости | P0 | Done | M | High | Yes | До первого демо | Repo |
| Frontend | Lead magnet page | P0 | Done | S | High | Yes | До первого демо | Repo |
| Frontend | Exit-intent popup | P1 | Done | S | Medium | No | До первого демо | Repo |
| Frontend | Tripwire page | P2 | Done | S | Medium | No | До 10 клиентов | Repo |
| Frontend | Подключить lead forms к backend endpoint | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Frontend | Registration page with legal consent text | P0 | Partial | S | High | Yes | До первого клиента | Added |
| Frontend | Login/register production UX and error handling | P0 | Partial | M | High | Yes | До первого клиента | Repo |
| Frontend | Dashboard core screens | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Frontend | Admin dashboard | P1 | Partial | L | Medium | No | До 10 клиентов | Repo |
| Frontend | Skeleton loading states | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Frontend | Error boundaries | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Frontend | Responsive desktop-first SaaS UI | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Frontend | Dark/light theme | P2 | Todo | M | Low | No | До 100 клиентов | Checklist |
| Backend | FastAPI app architecture | P0 | Done | M | High | Yes | До первого демо | Checklist |
| Backend | JWT registration/login/refresh/logout | P0 | Done | L | High | Yes | До первого демо | Checklist |
| Backend | Forgot password flow | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Backend | Email verification via SMTP | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Backend | OAuth через Яндекс ID для входа | P2 | Todo | M | Low | No | До 100 клиентов | Checklist |
| Backend | OAuth через VK для будущих VK Ads | P2 | Todo | L | Low | No | До 100 клиентов | Checklist |
| Backend | Projects API | P0 | Done | M | High | Yes | До первого демо | Repo |
| Backend | Agents CRUD and launch/run/pause flow | P0 | Partial | L | High | Yes | До первого клиента | Repo |
| Backend | Yandex Direct OAuth connection | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Backend | Yandex token refresh | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Backend | Yandex Direct API v5 campaigns/ads/keywords | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Backend | Yandex API reports/statistics ingestion | P0 | Todo | XL | High | Yes | До первого клиента | Checklist |
| Backend | Queueing/rate limiting for Yandex API 10 req/s | P1 | Partial | L | Medium | No | До 10 клиентов | Checklist |
| Backend | Unit tests for Yandex API methods | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Backend | Yandex Metrika counters/stat data | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Backend | Link Direct campaign to Metrika goals | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Backend | Referral program backend | P1 | Partial | M | Medium | No | До 10 клиентов | Repo |
| Backend | Competitor radar backend | P2 | Partial | L | Medium | No | До 100 клиентов | Repo |
| Backend | Image briefs backend | P2 | Partial | M | Medium | No | До 100 клиентов | Repo |
| Backend | Feedback endpoint and admin feedback list | P1 | Partial | M | Medium | No | До 10 клиентов | Repo |
| AI | Выбрать production LLM с учетом 152-ФЗ и cross-border transfer | P0 | Blocked | M | High | Yes | До первого клиента | Checklist |
| AI | Data anonymization/redaction policy for LLM | P0 | Todo | M | High | Yes | До первого клиента | Checklist |
| AI | Pipeline: metrics -> anomalies -> recommendations -> ranking -> storage | P0 | Partial | XL | High | Yes | До первого клиента | Checklist |
| AI | Deterministic issue detection: CPA, CTR, budget, placements | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| AI | Confidence score 0-100 per recommendation | P0 | Done | S | High | Yes | До первого клиента | Repo |
| AI | Store action history and results as agent memory | P1 | Partial | L | Medium | No | До 10 клиентов | Checklist |
| AI | Cron analysis every 4-6 hours | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| AI | Daily report at 08:00 | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| AI | Token usage accounting by user/period | P0 | Partial | L | High | Yes | До первого клиента | Repo |
| AI | Token/cost accounting by tenant/project/feature/model | P1 | Todo | L | High | No | До 10 клиентов | Added |
| AI | PDF/report generation from audit findings | P0 | Todo | L | High | Yes | До первого клиента | Added |
| Marketing | Лендинг на основном домене | P0 | Partial | M | High | Yes | До первого демо | Checklist |
| Marketing | Домен .ru/.рф registered and connected | P0 | Blocked | S | High | Yes | До первого клиента | Checklist |
| Marketing | SSL certificate | P0 | Partial | S | High | Yes | До первого клиента | Checklist |
| Marketing | Lead capture endpoint for quiz/lead magnet/exit-intent | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Marketing | Lead delivery: email/Telegram/Max | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Marketing | CRM follow-up after lead submission | P0 | Partial | M | High | Yes | До первого клиента | Added |
| Marketing | Яндекс Метрика на лендинге | P0 | Todo | S | High | Yes | До первого клиента | Checklist |
| Marketing | Яндекс Вебмастер | P1 | Todo | S | Medium | No | До 10 клиентов | Checklist |
| Marketing | UTM taxonomy for all channels | P0 | Partial | S | High | Yes | До первого клиента | Checklist |
| Marketing | Paid traffic campaigns in Yandex Direct/VK | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Marketing | Helpdesk: Юздеск/Омнидеск | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Marketing | Knowledge base | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Marketing | Live chat | P2 | Todo | S | Low | No | До 100 клиентов | Checklist |
| Marketing | Referral links and reward activation | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Security | OWASP Top 10 review | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Security | SQL injection protection review | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Security | XSS protection review | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Security | CSRF protection for cookie-auth mutations | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Security | Encrypt Yandex/OAuth tokens in DB | P0 | Done | M | High | Yes | До первого клиента | Checklist |
| Security | Audit log: who changed what and when | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Security | 2FA for admins | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Security | Secret rotation process | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Security | Demo admin/seed disabled in production | P0 | Todo | S | High | Yes | До первого клиента | Added |
| Security | Dependency audit: npm + Python | P0 | Todo | S | High | Yes | До первого клиента | Added |
| Security | Supabase Edge Functions CORS and error hardening | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Compliance | Register ООО or ИП | P0 | Blocked | M | High | Yes | До первого клиента | Checklist |
| Compliance | Open business bank account | P0 | Blocked | S | High | Yes | До первого клиента | Checklist |
| Compliance | Choose tax system / OKVED | P0 | Blocked | S | High | Yes | До первого клиента | Checklist |
| Compliance | User agreement / SaaS offer | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Compliance | Privacy policy | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Compliance | Personal data processing policy 152-ФЗ | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Compliance | Personal data consent form | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Compliance | Consent event storage with version/IP/user-agent/source | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Compliance | Notify Roskomnadzor if required | P0 | Blocked | M | High | Yes | До первого клиента | Checklist |
| Compliance | Appoint person responsible for PДн | P0 | Blocked | S | High | Yes | До первого клиента | Checklist |
| Compliance | Store Russian citizens PДн on servers in Russia | P0 | Blocked | L | High | Yes | До первого клиента | Checklist |
| Compliance | Data deletion request flow | P0 | Todo | M | High | Yes | До первого клиента | Checklist |
| Compliance | Harm assessment under 152-ФЗ | P1 | Blocked | M | Medium | No | До 10 клиентов | Checklist |
| Compliance | Advertising law category checks | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Compliance | ORD/ERID workflows | P2 | Todo | XL | Medium | No | До 100 клиентов | Checklist |
| Infrastructure | PostgreSQL production DB in RF contour | P0 | Blocked | L | High | Yes | До первого клиента | Checklist |
| Infrastructure | Redis cache/queue | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Infrastructure | Celery worker/beat | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Infrastructure | Object storage S3-compatible for reports/assets | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Docker Compose deploy | P0 | Partial | M | High | Yes | До первого клиентa | Repo |
| Infrastructure | CI/CD pipeline | P0 | Todo | M | High | Yes | До первого клиента | Checklist |
| Infrastructure | Git repository policy | P0 | Partial | S | High | Yes | До первого клиента | Checklist |
| Infrastructure | Task tracker | P1 | Todo | S | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Team NDA | P1 | Blocked | S | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Grafana/Prometheus or ELK | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Telegram alerts | P1 | Partial | M | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Uptime monitoring | P0 | Todo | S | High | Yes | До первого клиента | Checklist |
| Infrastructure | Error tracking: Sentry self-hosted/Glitchtip | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Infrastructure | Backup and restore drill | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Infrastructure | Load testing k6/JMeter | P2 | Todo | M | Medium | No | До 100 клиентов | Checklist |
| Infrastructure | Kubernetes/CDN/read replicas | P2 | Todo | XL | Low | No | До 100 клиентов | Checklist |
| Analytics | Admin funnel metrics | P1 | Partial | M | Medium | No | До 10 клиентов | Repo |
| Analytics | Яндекс Метрика event map | P0 | Todo | S | High | Yes | До первого клиента | Added |
| Analytics | Product analytics: PostHog self-hosted | P1 | Todo | M | Medium | No | До 10 клиентов | Checklist |
| Analytics | UTM tracking Edge Function | P1 | Partial | M | Medium | No | До 10 клиентов | Repo |
| Analytics | Fix broken `track-utm` fallback | P1 | Todo | S | Medium | No | До 10 клиентов | Added |
| Analytics | Activation funnel events | P0 | Todo | M | High | Yes | До первого клиента | Added |
| Analytics | Payment funnel events | P0 | Partial | M | High | Yes | До первого клиента | Added |
| Analytics | Retention/cohort dashboard | P2 | Todo | L | Medium | No | До 100 клиентов | Added |
| Billing | Choose payment provider for MVP: Robokassa vs ЮKassa | P0 | Partial | S | High | Yes | До первого клиента | Checklist |
| Billing | Robokassa merchant production credentials | P0 | Blocked | S | High | Yes | До первого клиента | Repo |
| Billing | Create-payment flow | P0 | Partial | M | High | Yes | До первого клиента | Repo |
| Billing | Webhook payment status | P0 | Partial | M | High | Yes | До первого клиента | Checklist |
| Billing | Disable stub payment in production | P0 | Todo | S | High | Yes | До первого клиента | Added |
| Billing | Plans: Free/Pro/Agency token limits | P0 | Done | M | High | Yes | До первого клиента | Repo |
| Billing | Server-side tariff limits for accounts/projects/audits | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Billing | Token balance UI/API | P0 | Partial | M | High | Yes | До первого клиента | Repo |
| Billing | Auto renewal / recurring payments | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Billing | Receipts and closing documents | P1 | Todo | L | Medium | No | До 10 клиентов | Checklist |
| Billing | Refund policy and terms | P0 | Todo | S | High | Yes | До первого клиента | Added |
| Agency Mode | Tenant model: `tenants` | P0 | Todo | L | High | Yes | До первого клиента | Checklist |
| Agency Mode | Membership model: `memberships` with roles | P0 | Todo | L | High | Yes | До первого клиента | Checklist |
| Agency Mode | Clients under agency tenant | P1 | Todo | L | Medium | No | До 10 клиентов | Added |
| Agency Mode | Project/client scoped permissions | P0 | Todo | XL | High | Yes | До первого клиента | Added |
| Agency Mode | RLS by tenant_id/project scope | P0 | Todo | XL | High | Yes | До первого клиента | Checklist |
| Agency Mode | Tenant-level audit logs | P0 | Partial | L | High | Yes | До первого клиента | Checklist |
| Agency Mode | Employee invites | P1 | Partial | L | Medium | No | До 10 клиентов | Repo |
| Agency Mode | Admin employees pages | P1 | Partial | M | Medium | No | До 10 клиентов | Repo |
| Agency Mode | Payroll module | P2 | Partial | L | Low | No | До 100 клиентов | Repo |
| Agency Mode | Client read-only portal | P2 | Todo | XL | Medium | No | До 100 клиентов | Added |

## 3. Недостающие пункты, которых не хватало в исходном чек-листе

Критичные добавления:
- Lead capture endpoint с сохранением source/UTM/quiz answers/contact channel.
- Consent event log: version, text, IP, user-agent, form/source.
- CSRF protection для cookie-auth mutations.
- Production guard: payment stub запрещен в `env=prod`.
- Production guard: demo users/demo admin не создаются в `env=prod`.
- Backup/restore drill before first payment.
- Real first audit report: user must receive value before payment.
- Activation funnel events.
- Payment funnel events.
- AI token/cost accounting by tenant/project/feature/model.
- Tenant/membership/client/project scoping before agency positioning.
- Edge Function CORS/error hardening.
- Dependency audit for npm and Python.

## 4. Roadmap by Milestone

### До первого демо

Цель: показать продукт как понятный, убедительный demo без обещания production-grade безопасности.

P0:
- Финализировать demo story: “подключили кабинет -> AI нашел потери -> получили план действий”.
- Проверить главную, quiz, lead magnet, ROI calculator, register/login.
- Подготовить demo data без риска утечки реальных ПДн.
- Убрать визуальные несостыковки в landing/admin/product flows.
- Обновить README: demo credentials clearly marked as local-only.
- Подготовить script для 5-минутного демо.

P1:
- Добавить скриншоты/видео demo dashboard.
- Сформировать one-page commercial offer для пилотов.

### До первого клиента

Цель: принять первую оплату безопасно и выдать измеримый результат.

P0:
- Реальный lead capture и CRM follow-up.
- Согласия и legal docs с реквизитами.
- Российский контур хранения ПДн или зафиксированное production решение.
- Robokassa/ЮKassa production credentials, webhook smoke test.
- Запрет payment stub в prod.
- Запрет demo seed/admin в prod.
- CSRF protection.
- Yandex OAuth real account smoke test.
- Первый audit report/PDF/in-app findings.
- Backup/restore test.
- Uptime monitoring.
- Support channel.

P1:
- Email/Telegram/Max delivery для отчета.
- Product analytics events for activation/payment.

### До 10 клиентов

Цель: повторяемый onboarding и поддержка без ручного хаоса.

P0:
- Минимальный tenant/membership model или честно single-user positioning.
- Server-side limits by plan.
- Error tracking.
- Admin CRM queue for leads, trials, paid users.
- Dependency/security audit in CI.

P1:
- Yandex Metrika integration.
- Better audit heuristics and AI summary.
- Referral activation.
- Knowledge base.
- Helpdesk.
- Product analytics dashboard.
- Recurring billing decision.

### До 100 клиентов

Цель: масштабируемость, агентский режим, расширение каналов.

P0:
- Tenant/project scoped permissions mature enough for agencies.
- Monitoring, alerting, logs, restore process verified.
- Billing docs/receipts/closing documents production-ready.

P1:
- Competitor radar with real data.
- Image generation assets.
- White-label reports.
- Client read-only portal.
- VK Ads integration.

P2:
- ORD/ERID workflows.
- Kubernetes/CDN/read replicas.
- Advanced feature flags and experiments.
- NPS/cohorts/retention analytics.

## 5. Импорт в Google Sheets или Notion

Рекомендуемые колонки:

```tsv
Block	Task	Priority	Status	Complexity	Impact	MVP Required	Milestone	Source	Owner	Due Date	Notes
Product	Зафиксировать узкий MVP: Yandex Direct audit + lead capture + paid plan	P0	Todo	M	High	Yes	До первого демо	Added			
Marketing	Lead capture endpoint for quiz/lead magnet/exit-intent	P0	Todo	M	High	Yes	До первого клиента	Added			
Security	CSRF protection for cookie-auth mutations	P0	Todo	M	High	Yes	До первого клиента	Added			
Compliance	Consent event storage with version/IP/user-agent/source	P0	Todo	M	High	Yes	До первого клиента	Added			
Billing	Disable stub payment in production	P0	Todo	S	High	Yes	До первого клиента	Added			
Agency Mode	Tenant model: tenants	P0	Todo	L	High	Yes	До первого клиента	Checklist			
AI	PDF/report generation from audit findings	P0	Todo	L	High	Yes	До первого клиента	Added			
Infrastructure	Backup and restore drill	P0	Todo	M	High	Yes	До первого клиента	Added			
Analytics	Activation funnel events	P0	Todo	M	High	Yes	До первого клиента	Added			
```

Для полного импорта можно скопировать таблицу из раздела `Master Task Table`
в Google Sheets/Notion: Markdown-таблицы Notion распознаёт напрямую, Google
Sheets лучше принимает через copy/paste по строкам или через TSV на основе
тех же колонок.

## 6. Рекомендуемый порядок работ на ближайшие 10 задач

1. `P0 Compliance`: финализировать legal docs и consent copy.
2. `P0 Compliance`: принять решение по российскому контуру хранения ПДн.
3. `P0 Marketing`: backend lead capture endpoint.
4. `P0 Frontend`: подключить все формы к lead endpoint.
5. `P0 Billing`: запретить payment stub в production.
6. `P0 Security`: запретить demo seed/admin в production.
7. `P0 Security`: добавить CSRF protection.
8. `P0 Backend/AI`: довести первый Yandex audit до полезного отчета.
9. `P0 Analytics`: события funnel/activation/payment.
10. `P0 Infrastructure`: backup/restore smoke test.

## 7. Вывод

Исходный чек-лист правильный по ширине, но слишком “enterprise/full SaaS” для
первой оплаты. Для ДОЖИМ-АЙ сейчас лучше идти через узкий paid pilot: лиды,
согласия, реальный audit result, платежи, безопасность и юридический контур.
Agency Mode, VK Ads, ORD, Kubernetes и advanced BI стоит держать в roadmap,
но не ставить перед первым клиентом, кроме минимального tenant-решения, если
продукт уже продается агентствам.
