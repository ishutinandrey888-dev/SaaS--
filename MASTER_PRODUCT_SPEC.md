# MASTER_PRODUCT_SPEC.md

Master product specification for ДОЖИМ-АЙ.

This document consolidates product, architecture, security, compliance, billing,
and roadmap decisions for the SaaS. It complements, but does not replace:

- `README.md` for local launch and current modules.
- `DESIGN.md` for landing and product surface design rules.
- `SUPABASE_SETUP.md` for Supabase setup.
- `docs/production-readiness.md` for deployment readiness and smoke tests.

## 1. Product Description

ДОЖИМ-АЙ is a SaaS platform for marketers, agencies, and small performance
teams that helps audit, improve, and automate digital marketing.

The product combines:

- Яндекс Директ campaign analysis and recommendations.
- VK Ads analysis and future campaign support.
- AI analytics for ads, landing pages, SEO, competitors, and funnel quality.
- Landing page and offer diagnostics.
- SEO checks and semantic recommendations.
- Telegram bot and business automation workflows.
- Agency mode for managing multiple clients and projects.
- Subscription billing, usage limits, and AI-cost controls.

The central promise: help teams find wasted budget, missed conversion
opportunities, weak offers, tracking gaps, and repetitive manual work, then turn
those findings into prioritized actions.

## 2. Target Users

- Performance marketers who manage Яндекс Директ and VK Ads campaigns.
- Marketing agencies that manage many client accounts and need standardized
  audits, reporting, and operational control.
- Small business owners who need understandable recommendations without hiring a
  large marketing team.
- Freelance traffic managers who need faster audits, client reporting, and
  upsell opportunities.
- Internal growth teams that need cross-channel diagnostics, landing checks,
  SEO signals, and automation.

## 3. Core Roles

- Owner: controls tenant settings, billing, integrations, team access, legal
  documents, and deletion/export operations.
- Admin: manages users, clients, projects, integrations, reports, and audit
  settings inside a tenant.
- Marketer: works with projects, ad accounts, audits, recommendations, exports,
  and AI analysis.
- Analyst: reads reports, creates findings, prepares recommendations, and tracks
  metrics.
- Client: views allowed projects, reports, dashboards, and selected
  recommendations.
- Finance/Billing manager: sees plans, invoices, payment state, usage, and
  limits.
- Support/Ops: handles feedback, operational incidents, AI budget alerts,
  webhook failures, and audit logs.

Roles must be tenant-scoped. Agency employees may have access to specific
clients or projects without seeing unrelated client data.

## 4. Tariffs And Limits

Initial tariffs follow the current project direction in
`docs/production-readiness.md`:

| Plan | Target | Included AI tokens | Price | Notes |
| --- | --- | ---: | ---: | --- |
| Free | Trial and lead capture | 500 | 0 RUB | Limited audits, demo data, strong upsell path. |
| Pro | Freelancers and small teams | 5,000 | 5,990 RUB/mo | Core audits, projects, reports, integrations. |
| Agency | Agencies and teams | 15,000 | 19,900 RUB/mo | Multi-client mode, larger limits, team access. |

Server-side limits should include:

- AI tokens and monthly AI budget.
- Projects per tenant.
- Clients per agency.
- Connected ad accounts.
- Audit runs per day/month.
- Report exports.
- Team members.
- Webhook and automation volume.
- Storage for generated assets and uploaded files.

When usage reaches 80% of a paid limit, the UI should warn the user. When a
hard limit is reached, the backend must block paid-resource operations and offer
upgrade or token/package purchase flows.

## 5. MVP Scope

MVP must be narrow enough to sell and broad enough to prove the platform:

- Registration, login, tenant creation, and role-based access.
- Agency/client/project hierarchy.
- Яндекс Директ OAuth connection and account/project mapping.
- Basic campaign audit: wasted spend, missing negative phrases, weak metrics,
  tracking gaps, and prioritized recommendations.
- AI analyst runs with token accounting and budget limits.
- Landing page diagnostic checklist and conversion recommendations.
- Basic SEO/offer observations for a project.
- Competitor radar or deterministic competitor brief as a beta feature.
- Billing plans, token balance, usage warnings, and payment flow.
- Admin/Ops dashboard for feedback, AI budget, audits, and incidents.
- Legal pages: personal data policy, consent, user agreement, cookies, and
  compliance notes.
- Production deployment checklist and smoke-test path.

Out of MVP unless already implemented: full campaign publishing, full VK Ads
write-back, custom CRM builder, advanced BI, white-label portals, and autonomous
budget-changing agents.

## 6. Architecture

Current stack:

- Frontend: Next.js / React / TypeScript / Tailwind.
- Backend: FastAPI / Python / SQLAlchemy / Alembic / Celery.
- Database/Auth direction: Supabase / PostgreSQL / RLS / JWT.
- Deployment: Vercel for frontend where appropriate, Docker/VPS services for
  backend and worker, and a Russian personal-data storage contour for
  production.
- Integrations: Telegram Bot API, MCP integrations, Яндекс Директ, VK Ads,
  Яндекс Метрика, Wordstat, Robokassa, AI providers.

Production architecture must separate:

- Public frontend.
- Backend API.
- Worker/queue processing.
- PostgreSQL/Supabase-compatible database.
- Object/file storage.
- Secrets management.
- Monitoring and audit logs.
- Russian personal-data storage contour.

For Russian citizens' personal data, the primary production database must be in
Russia. Non-Russian services may be used only after assessing cross-border data
transfer, minimizing personal data, and documenting the transfer path.

## 7. Multi-Tenant Model

Tenant model:

- Tenant represents an agency, company, freelancer workspace, or internal team.
- Agency tenants can create clients.
- Clients can have multiple projects.
- Projects can connect ad accounts, Метрика counters, landing URLs, SEO checks,
  reports, bots, and automations.
- Users belong to tenants through memberships.
- Memberships define roles, permissions, and optional client/project scopes.

Isolation principles:

- Every tenant-owned table needs `tenant_id` or an equivalent scoped ownership
  path.
- Backend authorization must check tenant membership and project/client scope.
- Supabase RLS must enforce tenant isolation for direct database access paths.
- `service_role` access must be restricted to trusted backend or Edge Function
  code and never exposed to browser code.
- Agency users must not see unrelated agency clients unless explicitly granted.

## 8. Data Model

Core entities:

- `tenants`: workspace/company/agency.
- `users`: authenticated users.
- `memberships`: user-to-tenant role and status.
- `clients`: agency-managed clients.
- `projects`: marketing projects owned by tenant/client.
- `ad_accounts`: connected Яндекс Директ, VK Ads, and future channels.
- `integrations`: OAuth tokens, provider metadata, sync state, scopes.
- `campaign_snapshots`: imported campaign metrics and settings over time.
- `audit_runs`: audit execution, status, source, costs, and summary.
- `audit_findings`: individual findings with severity, category, evidence, and
  recommendation.
- `ai_runs`: AI model, prompt version, token usage, cost, tenant/project/user.
- `usage_counters`: plan usage by billing period.
- `subscriptions`: plan, status, renewals, limits.
- `payments`: provider payments, invoices, receipts, and webhook state.
- `reports`: generated exports and client-facing report views.
- `landing_checks`: URL checks, conversion findings, technical findings.
- `seo_checks`: semantic, technical, and content findings.
- `bot_flows`: Telegram/chatbot automation configuration.
- `webhook_events`: inbound provider events, signatures, idempotency, status.
- `audit_logs`: security and business-critical event history.

Recommended shared columns:

- `id`, `tenant_id`, `created_at`, `updated_at`.
- `created_by_user_id` where user attribution matters.
- `deleted_at` for recoverable business entities.
- `metadata` only for provider-specific fields that do not deserve first-class
  columns yet.

Indexes should cover tenant filters, foreign keys, integration sync lookups,
audit timelines, billing periods, and frequently filtered statuses.

## 9. AI Analytics

AI-аналитика is a core product capability, not a decorative assistant layer.
AI analytics must be practical, explainable, and cost-controlled.

Core AI flows:

- Campaign audit summary and prioritized action plan.
- Negative phrase and search-query analysis.
- Landing page conversion analysis.
- SEO and offer gap analysis.
- Competitor and market positioning brief.
- Report generation for clients.
- Chat/assistant interface for project questions.
- Future autonomous agents for recurring checks.

Rules:

- Track token usage and estimated cost per tenant, project, feature, model, and
  billing period.
- Use prompt versions for reproducibility.
- Store enough input/output metadata for debugging and audit, but avoid storing
  unnecessary personal data.
- Redact or anonymize personal data before sending it to external AI providers
  when possible.
- Apply monthly AI budget caps and alert thresholds.
- Human approval is required before any future agent changes live advertising
  budgets, campaign settings, or client-facing legal content.

## 10. Integrations

Priority integrations:

- Яндекс Директ: OAuth, accounts, campaigns, groups, ads, keywords, search
  phrases, spend, clicks, conversions, and recommendations.
- Яндекс Метрика: goals, conversions, UTM validation, landing performance, and
  funnel diagnostics.
- Wordstat: demand signals, phrase expansion, and competitor/semantic checks.
- VK Ads: account connection, campaign import, creative/audience diagnostics.
- Telegram Bot API: operational alerts, daily digests, lead notifications, and
  automation flows.
- Robokassa: subscriptions, token packages, payment status, receipts, and
  webhook processing.
- MCP integrations: controlled access to external tools and data sources.
- AI providers: text analysis, report generation, creative suggestions, and
  possible image generation.

Integration requirements:

- Store OAuth tokens encrypted.
- Refresh tokens server-side.
- Validate webhook signatures and replay windows.
- Use idempotency for provider callbacks.
- Log sync failures without leaking secrets.
- Respect provider rate limits and queue long jobs.

## 11. Security

Security baseline:

- Run a security review for changes that touch authentication, authorization,
  tenant data, payments, integrations, AI processing, webhooks, public forms,
  infrastructure, secrets, or database access.
- Maintain a threat model and update it when architecture changes.
- Validate authorization for every tenant, client, project, report, integration,
  billing, and admin object.
- Test SQL Injection, XSS, CSRF, SSRF, API authorization, webhook validation,
  and secrets exposure.
- Enforce Supabase RLS for tenant-owned tables.
- Keep `service_role` keys only in backend/server environments.
- Protect `.env`, deploy env files, CI logs, and examples from secret leakage.
- Use rate limits and request size limits for auth, AI, reports, webhooks,
  imports, and public forms.
- Add DDoS protection at edge/proxy/provider level.
- Maintain audit logs for auth, billing, admin actions, integration changes,
  tenant changes, data exports, AI budget events, and security-relevant errors.
- Maintain backup and recovery procedures, including restore tests.
- Prefer least privilege for database roles, provider tokens, and internal
  service accounts.

High-risk flows:

- Billing webhooks.
- OAuth callbacks.
- AI jobs that process uploaded or imported data.
- Admin operations.
- Agency/client access switching.
- Public lead forms and landing diagnostics.
- Telegram bot commands and webhooks.

## 12. Russian Compliance

Required compliance direction:

- Account for 152-ФЗ in product, architecture, forms, storage, logs, support,
  exports, and third-party integrations.
- Treat ПДн РФ as regulated data: primary storage for Russian citizens'
  personal data must be on Russian servers in production.
- Personal data of Russian citizens must be stored on Russian servers in
  production.
- The primary production database for Russian citizens' personal data must not
  exist only outside Russia.
- Collect consent for personal data processing before processing personal data.
- Provide and version a personal data processing policy.
- Provide and version a user agreement.
- Provide cookie/analytics disclosure where relevant.
- Assess cross-border personal data transfer before using non-Russian hosting,
  AI providers, analytics, CRM, support, or automation tools.
- Minimize personal data sent to external AI providers; redact where possible.
- Support data subject workflows where required: access, correction, withdrawal,
  deletion/blocking, and export where applicable.
- Account for Russian advertising labeling, ОРД, and ЕРИР in advertising
  workflows, especially for agency exports, creative production, campaign
  recommendations, and publishing flows.

Operational compliance artifacts:

- Personal data policy.
- Consent text and consent event storage.
- User agreement.
- Data processing register.
- Third-party processor/register list.
- Cross-border transfer assessment.
- Advertising marking/ОРД/ЕРИР workflow notes.
- Incident response and breach handling procedure.

This section is an engineering/product requirement, not legal advice. Final
legal wording must be reviewed by qualified counsel.

## 13. Billing

Billing must support:

- Subscription plans.
- Token balance and AI usage counters.
- Payment provider webhooks.
- Plan upgrades/downgrades.
- Token package purchases.
- Usage warnings at 80% of relevant limits.
- Hard stops when paid resources are exhausted.
- Agency billing for multiple clients/projects.
- Invoices/receipts according to provider and legal requirements.
- Admin/Ops visibility into revenue, failed payments, AI cost, and margins.

Billing enforcement must happen server-side. The frontend can explain limits and
guide upgrades, but must not be the source of truth for paid access.

Unit-economics guardrails:

- Track gross revenue per tenant.
- Track AI cost per tenant and feature.
- Track provider/payment fees.
- Alert when AI cost exceeds expected plan economics.
- Keep expensive analysis queued, cancellable, and observable.

## 14. MVP Roadmap: 14 Days

Day 1:

- Confirm MVP scope, roles, tenant hierarchy, and legal/compliance baseline.
- Audit current schema, RLS, and backend auth paths.

Day 2:

- Stabilize registration, login, tenant membership, and role checks.
- Verify legal pages and consent capture.

Day 3:

- Finalize project/client/ad account model.
- Add missing indexes and RLS policy checks.

Day 4:

- Harden Яндекс Директ OAuth and account mapping.
- Add sync status and safe error reporting.

Day 5:

- Build first useful campaign audit findings: spend waste, weak metrics,
  missing tracking, negative phrase opportunities.

Day 6:

- Add AI analyst summary with prompt versioning, token tracking, and budget
  accounting.

Day 7:

- Build report view/export for a client-friendly audit result.

Day 8:

- Add landing page audit checklist and conversion recommendations.

Day 9:

- Add billing enforcement for plan limits and token exhaustion.

Day 10:

- Harden Robokassa webhook idempotency, signature checks, and payment state.

Day 11:

- Add admin/Ops dashboard for feedback, AI budget, incidents, and key metrics.

Day 12:

- Run security pass: API authz, RLS, SQL Injection, XSS, CSRF, SSRF, webhooks,
  secrets, logs.

Day 13:

- Run production readiness pass: envs, deploy, backups, smoke tests, monitoring,
  DDoS/rate limits.

Day 14:

- Prepare first-sales demo: seeded project, sample audit, landing, pricing,
  onboarding path, and sales script.

## 15. Roadmap To First Sale

1. Define first ICP: small agencies and freelance performance marketers working
   with Яндекс Директ.
2. Create demo account with realistic campaigns, findings, and report output.
3. Ship landing with clear offer: "find wasted Яндекс Директ budget and get a
   prioritized action plan."
4. Add lead magnet: free audit checklist or mini diagnostic.
5. Prepare sales flow: discovery call, demo, trial, paid Pro/Agency conversion.
6. Run outreach to existing network, Telegram communities, agency owners, and
   performance marketers.
7. Offer first paid pilot with manual concierge support.
8. Capture objections and turn them into product fixes or landing copy.
9. Add case-study template: before/after findings, savings, CPA improvements,
   implementation plan.
10. Close first sale, monitor usage daily, and prioritize retention blockers.

Success criteria for first sale:

- A user connects or provides real campaign data.
- The product produces findings they consider useful.
- The user understands the next action.
- Billing works or a manual invoice path is defined.
- Compliance risks are understood before processing production personal data.

## 16. Production Readiness Checklist

Product:

- MVP scope is documented and visible to the team.
- Onboarding explains value quickly.
- Demo data and real-data paths are both supported.
- Legal pages are reachable from product and landing pages.

Architecture:

- Production personal-data storage contour is in Russia.
- Backend, worker, database, storage, and frontend deployment boundaries are
  documented.
- Queue and long-running job behavior is observable.
- Rate limits and DDoS protection are configured.

Security:

- Threat model exists and covers tenant isolation, integrations, AI, billing,
  webhooks, admin tools, and public forms.
- Supabase RLS is enabled and tested for tenant-owned data.
- Runtime database role cannot bypass RLS.
- `service_role` keys are server-only.
- Webhook signatures, replay protection, and idempotency are implemented.
- Secrets are not committed or exposed in public env vars.
- Audit logs cover high-risk actions.

Compliance:

- Personal data policy exists.
- User agreement exists.
- Consent capture is implemented and stored.
- Cross-border transfer paths are assessed.
- Advertising marking/ОРД/ЕРИР workflows are documented for ad-related
  production flows.

Billing:

- Plans and limits are enforced server-side.
- Robokassa production settings are configured.
- Payment webhooks are validated.
- AI token/cost accounting is active.
- 80% warnings and hard-limit behavior work.

Operations:

- Backups are configured.
- Restore procedure is tested.
- Logs and alerts exist for backend, worker, payments, AI budget, integrations,
  and failed jobs.
- Smoke tests are defined and run after deploy.
- Incident response owners and escalation paths are known.
