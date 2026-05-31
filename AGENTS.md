# AGENTS.md

Operational rules for Codex and other AI agents working in the ДОЖИМ-АЙ
repository.

## Product Context

ДОЖИМ-АЙ is a SaaS product for marketers, agencies, and performance teams.
The product focuses on Яндекс Директ, VK Ads, AI analytics, SEO, landing
pages, chat bots, business automation, agency workflows, multi-tenant access,
subscriptions, and usage limits.

Existing project documents are part of the source of truth:

- `README.md` - local launch, current product modules, stack, and development notes.
- `DESIGN.md` - visual system for landing pages and product surfaces.
- `SUPABASE_SETUP.md` - Supabase deployment and Edge Function setup.
- `docs/production-readiness.md` - production secrets, deploy checks, billing,
  integrations, and smoke tests.
- `docs/rls_policies.sql` and `docs/db-roles.sql` - database access controls.

Do not delete or overwrite these documents when updating project knowledge.
Merge new guidance into the most specific document and reference related docs.

## Required Skills

Use the relevant Codex skills before making substantial changes:

- `saas-architect` for product logic, MVP scope, roles, tariffs, database
  structure, integrations, and roadmap.
- `supabase-backend` for PostgreSQL, Supabase, RLS, Auth, Edge Functions,
  Storage, migrations, SQL, and backend logic.
- `landing-builder` for landing pages, UX, CTA, conversion structure, and
  frontend implementation.
- `dozhim-landing-design` for ДОЖИМ-АЙ landing design, Яндекс Директ-inspired
  UI, product demos, 3D concepts, and marketing surfaces.
- `landing-conversion-audit` for conversion, trust blocks, offer clarity, and
  marketing-page audits.
- `seo-specialist` for SEO structure, metadata, headings, schema.org, and
  content planning.
- `marketing-strategist` for positioning, ICP, funnels, unit economics, and
  growth hypotheses.
- `chatbot-automation` for Telegram bots, CRM automation, n8n/Make-style
  workflows, webhooks, and lead processing.
- `ads-creative-director` and `banner-agent` for advertising creatives,
  banners, hooks, and paid acquisition tests.

If a requested skill is unavailable, state that clearly and continue with the
closest safe fallback.

## Before Any Change

Before editing code, schema, infrastructure, legal text, or product docs:

1. Inspect the current structure with `rg --files` or equivalent.
2. Read the nearest relevant files before proposing changes.
3. Check `git status --short` and treat unrelated modified files as user work.
4. Do not revert, remove, or reformat unrelated changes.
5. Explain the intended plan for non-trivial changes.
6. Keep edits scoped to the requested behavior or document.
7. Prefer existing project patterns over new abstractions.

## Code Rules

- Use TypeScript types and existing Next.js App Router conventions in
  `frontend/`.
- Use FastAPI, SQLAlchemy, Alembic, and existing service/router boundaries in
  `backend/`.
- Use structured parsers, typed APIs, and existing helpers instead of ad hoc
  string manipulation where practical.
- Do not hardcode secrets, API keys, project IDs, tokens, payment credentials,
  OAuth secrets, service role keys, or webhook secrets.
- Keep `.env`, production credentials, and local secrets out of git.
- Do not introduce new runtime dependencies without a clear reason.
- Do not bypass existing auth, rate limiting, sanitization, billing checks, or
  RLS assumptions.
- Comments should explain non-obvious decisions, not restate the code.

## Security Requirements

Run a security review for any change that touches authentication,
authorization, tenant data, payments, integrations, AI processing, webhooks,
public forms, infrastructure, secrets, or database access.

Every meaningful feature must be reviewed against the project threat model.
At minimum, consider:

- SQL Injection in database queries, filters, admin endpoints, imports, and
  reporting/search flows.
- XSS in landing pages, dashboards, user-generated content, AI-generated text,
  ad previews, markdown, and embedded HTML.
- CSRF for cookie/session based mutations, billing operations, auth actions,
  and admin actions.
- SSRF in URL fetchers, competitor analysis, webhook handlers, integrations,
  image generation inputs, and import tools.
- API security: authentication, authorization, object ownership, rate limits,
  pagination limits, input validation, idempotency, and error disclosure.
- Supabase RLS: every tenant-owned table must have explicit policies; service
  role access must never be exposed to browser code.
- Webhooks: verify provider signatures, timestamp tolerance, replay protection,
  idempotency keys, and safe logging.
- Secrets: never log credentials; scan `.env*`, deploy config, CI output, and
  examples for accidental leakage.
- DDoS and abuse protection: rate limiting, request size limits, bot controls,
  queue backpressure, and provider budget caps.
- Backup and recovery: database backups, tested restore flow, migration rollback
  thinking, and operational runbooks.
- Audit logs: admin actions, billing actions, tenant changes, integration
  connections, high-risk AI actions, and security-relevant failures.

## Russian Compliance Requirements

The product must be designed for Russian legal constraints by default:

- Account for 152-ФЗ and personal data processing requirements.
- Treat ПДн РФ as regulated data: primary storage for Russian citizens'
  personal data must be on Russian servers in production.
- Personal data of Russian citizens must be stored on Russian servers in the
  production architecture.
- Do not design a production architecture where the primary database for
  Russian citizens' personal data exists only outside Russia.
- Collect and record consent for personal data processing before processing
  personal data.
- Maintain a personal data processing policy and make it available in the UI.
- Maintain a user agreement for account, billing, SaaS usage, and acceptable use.
- Consider cross-border personal data transfer before sending personal data to
  non-Russian providers, including AI, analytics, CRM, hosting, and support
  tools.
- Minimize personal data sent to third-party AI providers; anonymize or redact
  where possible.
- Account for Russian advertising marking requirements, ОРД, and ЕРИР for ad
  workflows, creative exports, campaign publishing, and agency operations.
- Keep legal text and compliance behavior explicit in product specs, onboarding,
  forms, billing, integrations, and admin tools.

This file is not legal advice. Treat it as an engineering and product checklist;
legal wording and final compliance decisions require qualified review.

## SaaS Architecture Rules

- Model the product as multi-tenant from the start.
- Core entities must support agencies, clients, projects, advertising accounts,
  campaigns, integrations, users, roles, subscriptions, usage counters, and
  audit logs.
- Enforce tenant isolation in backend authorization and database policies.
- Do not rely on frontend checks for tenant or role security.
- Keep agency mode first-class: agencies manage many clients and projects with
  scoped employee access.
- Billing and tariff limits must be enforced server-side.
- AI-аналитика must be observable, explainable, and cost-controlled.
- AI request cost must be tracked by tenant, project, user, feature, model, and
  billing period where possible.
- Expensive AI, parsing, import, export, and integration jobs should be queued
  and observable.

## Supabase And PostgreSQL Rules

- Enable and review RLS for tenant-owned tables.
- Use restricted database roles for application runtime access.
- Keep `service_role` keys only on trusted backend/server environments.
- Never expose service keys in Next.js client bundles, public env vars, logs, or
  Edge Function responses.
- Write migrations for schema changes and keep SQL files synchronized when they
  are project sources of truth.
- Add indexes for tenant filters, foreign keys, billing lookups, audit timelines,
  and integration sync jobs.
- Prefer explicit foreign keys, constraints, check constraints, and enums where
  they clarify product invariants.

## Verification After Changes

Choose checks based on the change:

- Documentation-only changes: inspect rendered Markdown/diff and verify files
  exist.
- Frontend changes: run `npm run typecheck` from `frontend/` and browser-check
  important desktop/mobile routes when practical.
- Backend changes: run relevant `pytest` tests from `backend/`.
- Database changes: review Alembic migration, RLS policy impact, and SQL syntax.
- Deploy changes: compare against `docs/production-readiness.md` and deploy env
  examples.
- Security-sensitive changes: verify authz paths, RLS, logging, secrets, webhook
  validation, rate limits, and audit logs.

Always report what was checked and what was not checked.
