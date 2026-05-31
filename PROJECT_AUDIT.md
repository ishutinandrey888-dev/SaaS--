# PROJECT_AUDIT.md

# Аудит проекта ДОЖИМ-АЙ

Дата аудита: 2026-05-31

Использованные рамки анализа:
- `saas-architect`: архитектура SaaS, MVP, роли, тарифы, API, roadmap.
- `security-review`: auth, RLS, secrets, webhooks, CORS, CSRF, IDOR, зависимости.
- `russian-legal-compliance`: 152-ФЗ, локализация ПДн, согласия, cookie, документы.
- `marketing-strategist`: ICP, оффер, воронка, лид-магниты, запуск.
- `supabase-backend`: PostgreSQL, Supabase, Edge Functions, RLS, миграции.

Это техническая и продуктовая compliance-проверка, а не юридическое заключение.

## 1. Текущая готовность продукта

Оценка: 57%.

Почему не выше:
- Сильная витрина и воронка уже собраны: главный лендинг, quiz, lead magnet, ROI-калькулятор, tripwire, exit-intent, cookie banner, legal pages.
- Backend уже имеет основу SaaS: auth, JWT, cookies, RLS-aware `UserDB`, admin/session split, billing, payments, Yandex OAuth, agents, referrals, competitors, image briefs, admin ops.
- Но MVP ещё не готов к первой оплате в production: нет полноценного tenant/agency model, часть интеграций работает в stub/deterministic режиме, legal documents содержат placeholders, лид-формы на лендинге не пишут заявки в backend/CRM, 152-ФЗ production-контур не зафиксирован как реализованный.

Готовность по слоям:
- Landing/conversion: 75%.
- Frontend кабинета: 55%.
- Backend core: 60%.
- Billing/payment flow: 55%.
- AI/Yandex product value: 40%.
- Admin/Ops: 60%.
- Supabase/RLS: 55%.
- Security production readiness: 45%.
- 152-ФЗ/compliance: 35%.
- Deployment readiness: 55%.

## 2. Что уже реализовано

Product/marketing:
- Главный лендинг ДОЖИМ-АЙ: `frontend/app/page.tsx`.
- Conversion-компоненты: `frontend/components/marketing-conversion.tsx`.
- Отдельные страницы: `/quiz`, `/lead-magnet`, `/roi-calculator`, `/tripwire`.
- Cookie banner: `frontend/components/cookie-consent.tsx`.
- Legal pages: `/privacy`, `/personal-data`, `/terms`, `/cookies`.
- Demo HTML assets: `frontend/public/demo-dashboard.html`, `frontend/public/admin-demo.html`.

Frontend app:
- Next.js 14 App Router, TypeScript, Tailwind.
- Auth pages: `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`.
- Dashboard/admin/product routes: `frontend/app/admin/*`, `frontend/app/analyst/*`, `/history`, `/settings`, `/yandex`.
- API client: `frontend/lib/api.ts`.
- Shared types: `frontend/lib/types.ts`.

Backend:
- FastAPI app entrypoint and router registration: `backend/app/main.py`.
- JWT auth with access/refresh cookies: `backend/app/routers/auth.py`.
- Password hashing and token crypto: `backend/app/core/security.py`.
- Brute-force guard and slowapi rate limits: `backend/app/middleware/rate_limit.py`.
- JSON sanitization middleware: `backend/app/middleware/sanitize.py`.
- Dual DB sessions: RLS-enforcing `UserDB` and admin `AdminDB`: `backend/app/core/database.py`.
- Projects, agents, dashboard, Yandex OAuth, billing, referrals, competitors, image briefs, feedback, admin routers.
- Celery tasks for agent runs and ops digest: `backend/app/tasks/agent_tasks.py`.
- Robokassa payment skeleton and webhook signature validation: `backend/app/routers/billing.py`, `backend/app/services/payments_robokassa.py`.
- Audit/events services and audit logs.

Database/Supabase:
- Alembic migrations `0001`-`0009`.
- RLS policies for user-owned core tables and new token/referral/competitor/image-brief tables.
- Restricted role guidance: `docs/db-roles.sql`.
- Supabase standalone schema/RLS/functions: `supabase/schema.sql`, `supabase/rls.sql`, `supabase/functions/*`.

Ops/deploy:
- Docker Compose local and deploy configs.
- VPS setup docs and production readiness checklist.
- Nginx templates and deploy scripts.

## 3. Что отсутствует для MVP

MVP blockers:
- Настоящая multi-tenant/agency модель: `tenants`, `memberships`, `clients`, scoped roles. Сейчас большинство таблиц и RLS завязаны на `user_id`, а не на workspace/client/project scope.
- Реальное сохранение лидов с лендинга. `LeadMagnetForm` в `frontend/components/marketing-conversion.tsx` меняет локальное состояние, но не отправляет email/Telegram/Max в backend/CRM.
- Реальный AI-аудит кампаний как ценность продукта. Агент имеет stub findings при пустом Yandex client id, а competitor radar пока deterministic stub.
- Production payment mode: Robokassa есть, но при пустых credentials включается stub. До оплаты нужно исключить silent stub в prod.
- Production legal/compliance pack: реквизиты оператора, политика ПДн, consent records, cookie categories, договор/оферта, возвраты, рекуррентность, чеки.
- 152-ФЗ production architecture: первичная база ПДн РФ должна быть в российском контуре; текущие docs допускают Supabase Cloud как setup path.
- Email/Telegram/Max delivery for reports and lead magnets.
- Onboarding после регистрации: referral code из query, выбор plan, создание проекта, Yandex OAuth, первый аудит.
- Real monitoring/backup/restore runbook and tested restore.
- Minimal E2E smoke tests for first paid flow.

Important but not strict MVP:
- VK Ads.
- Real Wordstat integration.
- Image generation provider and asset storage.
- White-label reports.
- Advanced payroll/admin modules.
- Autonomous budget-changing autopilot.

## 4. Critical проблемы

1. Нет production-safe tenant isolation.
   - Сейчас продуктовые таблицы в основном `user_id`-scoped.
   - Для агентств это ломает модель “агентство -> клиенты -> проекты -> сотрудники”.
   - Риск: невозможно безопасно дать сотруднику доступ к части клиентов.

2. Demo credentials and demo admin can leak to production.
   - `README.md` документирует `admin@dozim.ai / password`.
   - `backend/alembic/versions/0007_demo_admin.py` создаёт demo admin.
   - `backend/app/scripts/seed_demo_users.py` использует `password`.
   - Требование: запретить demo seed/migration в prod или вынести в local-only.

3. Payment stub may activate if Robokassa credentials are absent.
   - `payments_robokassa.py` включает stub при пустых credentials.
   - В production это должно fail closed, иначе можно получить ложные оплаты/планы.

4. Landing lead forms do not create real leads.
   - Quiz/lead magnet/exit-intent собирают contact только в UI.
   - Нет endpoint, consent log, CRM lead, notification.
   - Конверсия выглядит хорошо, но бизнес-данные теряются.

5. Legal pages are templates with placeholders.
   - `/privacy`, `/terms`, `/personal-data`, `/cookies` прямо говорят “замените реквизиты”.
   - Нельзя запускать paid traffic/платежи без финализации.

6. Supabase Edge Functions use service role with wildcard CORS.
   - `supabase/functions/*` создают service role client.
   - CORS `Access-Control-Allow-Origin: *`.
   - Ошибки возвращают `String(e)`.
   - Для production нужны origin allowlist, минимизация error disclosure, rate limit/abuse protection.

7. `track-utm` fallback looks broken.
   - `supabase/functions/track-utm/index.ts` fallback calls `supabase.rpc("coalesce", {})` inside update payload.
   - This is not a valid atomic increment pattern.

## 5. Security аудит

Strengths:
- JWT access/refresh split, httpOnly cookies, short access TTL.
- Password validation and hashing.
- Brute-force protection by email+IP.
- SlowAPI rate limits on sensitive endpoints.
- RLS-aware `UserDB` sets `request.jwt.claim.sub` and verifies it.
- AdminDB/UserDB separation is explicit.
- OAuth tokens are encrypted with Fernet.
- Robokassa webhook signature validation exists.
- Payment status endpoint checks ownership.
- CORS origins are config-driven for FastAPI.
- Docs disable OpenAPI in prod.

Critical/High risks:
- CSRF protection is incomplete for cookie-auth mutations. SameSite=Lax helps, but there is no CSRF token/double-submit protection for POST/PATCH/DELETE.
- Admin authorization is email-list based (`ADMIN_EMAILS`), not role-based or tenant-scoped.
- `get_current_user` uses AdminDB to load users; this is acceptable for auth, but routes must never reuse AdminDB for user-scoped object access.
- Some routes rely on RLS filtering instead of explicit `user_id` predicates. That is okay only if `DATABASE_URL_USER` is always NOBYPASSRLS and claim setting is reliable.
- Supabase Edge Functions return raw errors and have wildcard CORS.
- Service role is used inside Edge Functions; function-level auth and permission checks must be hardened.
- Public forms have no backend rate limit, CAPTCHA/bot strategy, or consent capture because they are frontend-only.
- Demo credentials and local secrets are documented; safe for local, dangerous if accidentally deployed.
- No visible dependency audit result (`npm audit`, `pip-audit`/`uv audit`) in docs.
- No request id/security audit trail for all high-risk admin mutations in Supabase Edge Functions.

Medium risks:
- Robokassa uses MD5 because provider requires it; compensate with password secrecy, IP allowlist and replay/idempotency.
- Webhook IP parsing trusts leftmost `X-Forwarded-For`; must be correct only behind trusted proxy.
- Sanitization middleware strips HTML in JSON, but output encoding still remains frontend responsibility.
- Competitor/image brief payloads accept flexible JSON; enforce size and schema before production.
- Telegram ops messages must avoid PII/secrets in payloads.
- CORS examples and standalone Supabase docs can encourage exposing anon/service keys incorrectly if copied blindly.

Immediate security fixes:
- Add CSRF token for cookie-auth mutations.
- In prod, reject startup when demo admin migration/seed is enabled or Robokassa credentials are missing while paid plans are public.
- Restrict Edge Function CORS to production domains.
- Replace raw `String(e)` responses with generic errors and log internally.
- Add backend lead endpoint with rate limits, consent fields and anti-spam controls.
- Add tenant/membership authorization before agency release.
- Run `npm audit --omit=dev` and a Python dependency audit before deploy.

## 6. Соответствие 152-ФЗ

Compliance status: not ready for production with Russian citizens' personal data.

Personal data currently processed or likely processed:
- Email, full name, password hash, IP, login attempts.
- Cookies/local storage consent flag.
- Contacts from lead forms: email, Telegram, Max/phone.
- Advertising account identifiers and OAuth tokens.
- Campaign data, potentially including client business data.
- CRM leads, feedback, payroll employee data.
- Payment records.

What is already present:
- Legal pages exist.
- Consent page exists.
- Cookie banner links to policy pages.
- Tokens are encrypted.
- Access control/RLS foundation exists.
- Docs mention Russian personal-data storage contour in `MASTER_PRODUCT_SPEC.md`.

Gaps:
- Legal pages still contain placeholders for operator details and commercial terms.
- No explicit consent record in backend for registration and landing forms.
- No production architecture proof that primary PДн DB is hosted in Russia.
- Supabase Cloud setup doc may conflict with 152-ФЗ if used as primary DB outside Russia.
- No data retention/deletion implementation.
- No subject access/export/delete request workflow.
- No list of processors/subprocessors and cross-border transfer basis.
- No documented Roskomnadzor/operator notification status.
- No separate privacy notice for AI provider data transfer.
- No checkbox/explicit consent on lead forms and registration UI captured server-side.

Minimum before launch:
- Finalize operator реквизиты, privacy policy, personal data consent, offer/terms, cookie policy.
- Store consent events: user/contact, text version, timestamp, IP, user agent, source form.
- Decide Russian hosting contour: self-hosted Supabase/Postgres or managed Postgres in Russia.
- Do not send raw personal data to OpenAI/foreign services unless legal basis and transfer docs are approved.
- Implement deletion/export request runbook.
- Check legal wording with qualified lawyer.

## 7. План запуска за 14 дней

Goal: paid pilot with 1-3 controlled customers, not open public launch.

Days 1-2:
- Freeze MVP scope: Yandex Direct audit, ROI calculator, lead capture, paid Pro/Agency.
- Disable or gate non-MVP features that create support debt.
- Decide production DB location for Russian PДн.

Days 3-4:
- Implement backend lead capture endpoint: source, contact channel, contact, consent, quiz answers, UTM, page.
- Write leads into `crm_leads` or a dedicated `marketing_leads` table.
- Add rate limits and bot protection.

Days 5-6:
- Harden billing: Robokassa real credentials required in prod, webhook smoke test, payment status, return page.
- Add admin lead review and manual follow-up path.

Days 7-8:
- Finalize legal docs with operator details and consent versioning.
- Add explicit consent checkbox/text to registration and lead forms.

Days 9-10:
- End-to-end Yandex OAuth smoke test with a real test account.
- Ensure first audit produces a useful PDF/report or in-app findings.

Days 11-12:
- Security pass: CSRF, CORS, Edge Function errors, demo admin gating, secrets scan, dependency audit.
- Backup/restore dry run.

Days 13-14:
- Deploy to staging/production, run smoke checklist.
- Invite 1-3 pilot clients.
- Track funnel: visit -> quiz/lead -> registration -> connected account -> first audit -> payment.

## 8. План запуска за 30 дней

Goal: public paid MVP for a narrow ICP.

Week 1:
- Complete 14-day blockers.
- Implement tenant/membership minimal model or explicitly position MVP as single-user first.
- Create first audit report format that a business owner understands.

Week 2:
- Improve Yandex Direct data ingestion and deterministic findings.
- Add AI summary with token accounting.
- Add CRM follow-up automation for quiz/lead/audit/payment events.

Week 3:
- Production compliance: Russian DB contour, consent logs, legal finalization, deletion/export flow.
- Harden Supabase Edge Functions or remove them from production path if FastAPI owns auth/admin.
- Add monitoring: logs, uptime, worker/beat health, payment webhook alerts.

Week 4:
- Conversion iteration: A/B CTA, quiz questions, lead magnet delivery, case/social proof.
- Add onboarding checklist and activation emails/Telegram.
- Run 10-20 paid traffic tests and 5-10 sales calls.
- Prepare first public launch checklist and support scripts.

## 9. Что нужно сделать до первой оплаты клиента

P0 before accepting money:
- Real Robokassa merchant configured and tested.
- Disable payment stub in prod.
- Finalize legal docs and operator details.
- Capture explicit personal-data consent.
- Confirm Russian PДн storage architecture.
- Remove/gate demo admin credentials from production.
- Working lead capture and admin follow-up.
- Working onboarding: register -> create project -> connect Yandex -> run first audit.
- Provide a useful result before asking payment: audit report, findings or quantified losses.
- Add refund/terms/payment conditions.
- Verify CORS, CSRF, webhook signatures and rate limits.
- Run smoke tests from `docs/production-readiness.md`.
- Backup/restore path documented and tested.

## 10. Приоритизированный roadmap

### P0

- Production legal/compliance pack.
- Russian PДн hosting decision and implementation.
- Real lead capture with consent logs.
- Payment production hardening.
- Demo credentials disabled in prod.
- CSRF protection for cookie-auth mutations.
- First audit flow with real or defensible deterministic Yandex findings.
- Tenant/agency decision: implement minimal tenant model or remove agency promises from MVP.
- Admin CRM for incoming leads and paid users.
- Staging/prod smoke tests.

### P1

- Minimal tenant/membership/client/project model.
- AI audit summary with token accounting.
- PDF/report delivery by email/Telegram/Max.
- Better onboarding checklist.
- Referral activation flow.
- Competitor radar with real data source.
- Image brief -> actual asset generation/storage.
- Monitoring dashboards and alerting.
- Dependency/security CI checks.
- Analytics events for funnel metrics.

### P2

- VK Ads integration.
- Yandex Metrika integration.
- Wordstat demand module.
- White-label agency reports.
- Payroll/admin ops expansion.
- Autonomous assistant/autopilot with stricter guardrails.
- Advanced billing: token packages, invoices, closing docs.
- Customer portal for client read-only access.

## Итог

ДОЖИМ-АЙ уже выглядит как убедительный SaaS-прототип с сильной маркетинговой оболочкой и заметной backend-базой. Самый короткий путь к деньгам — не расширять фичи, а закрыть P0: лиды, согласия, платежи, real audit, production security и юридический контур. После этого можно запускать платный pilot и собирать доказательства ценности на реальных рекламных кабинетах.
