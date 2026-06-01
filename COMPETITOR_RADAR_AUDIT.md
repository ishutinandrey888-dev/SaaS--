# Competitor Radar Audit

Дата аудита: 2026-05-31  
Проект: мини-продукт «Радар конкурентов» для ДОЖИМ-АИ  
Статус: аудит текущей реализации и план доработки до MVP

## 1. Executive Summary

Текущая реализация «Радара конкурентов» находится на стадии локального технического MVP, а не готового lead-magnet продукта. В репозитории есть:

- браузерное расширение Manifest V3 для Яндекс-поиска и Wordstat;
- in-page рабочая панель в дизайне ДОЖИМ-АИ;
- парсинг промо-объявлений Яндекс.Директа по метке `Промо`;
- базовый разбор офферов конкурентов;
- сбор ключевых фраз из Wordstat;
- локальное хранение в `chrome.storage.local`;
- HTML/JSON экспорт;
- простой Node backend без внешних зависимостей;
- demo API для projects, competitors, keywords и Telegram subscription-заготовки.

При этом в текущей рабочей папке отсутствуют полноценные backend models/routers/schemas на Python/FastAPI, frontend страницы lead-magnet/quiz/tripwire/ROI, Supabase tables/migrations, legal pages, analytics events и связанный пользовательский сценарий от первого ввода до лида и CTA на полный AI-аудит.

Главный вывод: текущий продукт доказывает feasibility сбора промо-объявлений и Wordstat-данных, но еще не является самостоятельным мини-продуктом для привлечения лидов. Следующий этап должен превратить extension prototype в web lead-magnet flow с сохранением лида, согласием на обработку ПДн, аналитикой событий и CTA в основной ДОЖИМ-АИ.

## 2. Product Definition

Цель мини-продукта: дать предпринимателю, маркетологу или агентству быстрый бесплатный конкурентный аудит по нише/сайту/ключевым фразам и перевести пользователя в основной продукт ДОЖИМ-АИ через прогретый CTA.

Ценность для пользователя:

- увидеть, кто рекламируется в Яндекс.Директе по ключевым запросам;
- понять, какие офферы конкуренты используют;
- увидеть повторяющиеся слабые места рынка;
- получить 3-5 идей для своей рекламы;
- получить расширенный AI-аудит в ДОЖИМ-АИ.

Ценность для бизнеса:

- собрать квалифицированный лид;
- понять нишу и потребность лида до продажи;
- дать быстрый aha-moment;
- сегментировать пользователя по нише, рекламной активности и уровню интереса;
- прогреть пользователя к полному AI-аудиту.

## 3. Current Implementation Map

### Реализовано

- Browser extension:
  - Manifest V3.
  - Content scripts для `yandex.ru/search`, `ya.ru/search`, `wordstat.yandex.ru`.
  - Кнопка `Радар конкурентов` в поиске Яндекса.
  - Кнопка `Радар Wordstat`.
  - Правая in-page панель.
  - Popup с проектом, фильтрами, backend URL, экспортом.
  - Брендинг ДОЖИМ-АИ.

- Competitor parsing:
  - Поиск меток `Промо`.
  - DOM-based и layout-based fallback parsing.
  - Извлечение `domain`, `title`, `description`, `detectedOffers`, `qualityScore`.
  - Признак `sourceType: yandex_direct_promo`.
  - Базовые гипотезы `insight` и `hypothesis`.

- Wordstat parsing:
  - Сбор видимых строк с фразами и частотностью.
  - Простая классификация intent: commercial, informational, brand/domain, mixed.

- Local storage:
  - `activeProject`.
  - `latestScan`.
  - `competitors`.
  - `keywords`.
  - backend settings and sync status.

- Backend skeleton:
  - `GET /health`.
  - `POST /auth/demo`.
  - `GET /projects`.
  - `POST /projects`.
  - `GET/POST /projects/:projectId/competitors`.
  - `GET/POST /projects/:projectId/keywords`.
  - `POST /subscriptions/telegram`.
  - JSON-file persistence in `backend/data/radar.json`.

### Частично реализовано

- Lead capture: есть endpoint `/subscriptions/telegram`, но нет frontend формы захвата лида и проверки подписки.
- Competitor data model: есть JSON structure и API collection, но нет typed DB schema, migrations, validation schemas, ownership model.
- Reports: есть HTML export, но нет PDF, share link, server-side report, Telegram report.
- Backend sync: расширение умеет отправлять сохранения на backend, но нет production auth, real users, rate limits.
- Analytics: нет формальной системы событий; можно восстановить только действия по storage/API косвенно.

### Отсутствует

- Web lead-magnet page.
- Quiz.
- Tripwire.
- ROI calculator.
- Marketing conversion component.
- Privacy / personal-data / terms pages.
- Cookie policy.
- Supabase schema/tables/RLS/migrations.
- Alembic migrations.
- Python backend `models/routers/schemas`.
- Production auth.
- Rate limiting.
- API validation schemas.
- Server-side analytics events.
- Consent storage.
- User-facing MVP flow outside browser extension.

### Не связано между собой

- Extension и backend связаны только локально через `http://localhost:8787`, не как production service.
- Telegram subscription endpoint не связан с UI, лидом, gating или CRM.
- HTML report живет локально, не связан с backend project/report entity.
- Wordstat keywords не связаны с competitor scan в единую проверку.
- Backend data не связана с legal consent, analytics, funnel stage или user journey.

## 4. Existing Files

### Найденные файлы текущей реализации

- `README.md`
- `backend/package.json`
- `backend/server.js`
- `backend/.gitignore`
- `extension/manifest.json`
- `extension/assets/dozhim-logo.png`
- `extension/src/background.js`
- `extension/src/shared/storage.js`
- `extension/src/content/yandex-search.js`
- `extension/src/content/wordstat.js`
- `extension/src/content/radar.css`
- `extension/src/popup/popup.html`
- `extension/src/popup/popup.css`
- `extension/src/popup/popup.js`
- `extension/src/sidepanel/sidepanel.html`
- `extension/src/sidepanel/sidepanel.css`
- `extension/src/sidepanel/sidepanel.js`

### Запрошенные файлы, которых нет в текущей рабочей папке

- `backend/app/models/competitor.py`
- `backend/app/routers/competitors.py`
- `backend/app/schemas/competitor.py`
- `backend/alembic/versions/0008_tokens_referrals_competitors_images.py`
- `frontend/app/lead-magnet`
- `frontend/app/quiz`
- `frontend/app/tripwire`
- `frontend/app/roi-calculator`
- `frontend/components/marketing-conversion.tsx`
- `frontend/app/privacy`
- `frontend/app/personal-data`
- `frontend/app/terms`
- `supabase/`
- `MASTER_PRODUCT_SPEC.md`
- `PROJECT_AUDIT.md`

## 5. Missing Pieces

Критичные missing pieces для MVP:

- Web entry point: страница, где пользователь вводит нишу/сайт/ключевые фразы без установки расширения.
- Lead capture: email/Telegram + чекбокс согласия на обработку ПДн.
- Consent record: дата, текст согласия/версия, источник, IP/user-agent по необходимости и с минимизацией.
- Competitor scan entity: одна проверка должна объединять input, competitors, offers, weaknesses, ideas, lead.
- Analytics events: start, submit, result_view, lead_submit, audit_cta_click.
- Legal pages: privacy, personal-data consent, terms, cookie notice.
- Rate limiting and abuse controls.
- API validation.
- Database schema and migrations.
- Clear CTA to full AI audit in ДОЖИМ-АИ.

## 6. MVP User Flow

1. Пользователь открывает lead-magnet page «Радар конкурентов».
2. Вводит нишу, сайт или 3-10 ключевых фраз.
3. Сервис запускает проверку:
   - для MVP можно использовать extension-assisted flow или backend mock/import из extension;
   - production MVP должен иметь server-side scan abstraction.
4. Пользователь видит:
   - список конкурентов;
   - домены;
   - промо-офферы;
   - рекламные крючки;
   - слабые места;
   - 3-5 идей для своей рекламы.
5. Для полного результата пользователь оставляет Telegram/email.
6. Пользователь принимает согласие на обработку ПДн.
7. Сервис сохраняет lead и событие конверсии.
8. Пользователь получает CTA:
   - «Получить полный AI-аудит в ДОЖИМ-АИ»;
   - «Отправить отчет в Telegram»;
   - «Разобрать мой сайт и рекламу».

## 7. Lead Generation Funnel

Recommended funnel:

1. Ungated preview:
   - 3 конкурента;
   - 3 оффера;
   - 1-2 слабых места;
   - 1 идея для рекламы.
2. Soft gate:
   - «Оставьте Telegram/email, чтобы получить полный список и 5 идей».
3. Full free result:
   - 5-10 конкурентов;
   - топ офферов;
   - слабые места;
   - идеи объявлений.
4. Warm CTA:
   - «Получить полный AI-аудит сайта и рекламы в ДОЖИМ-АИ».
5. Tripwire:
   - недорогой аудит или разбор рекламной кампании.
6. Core SaaS:
   - monitoring, recommendations, recurring audits, reports.

## 8. P0 / P1 / P2 Roadmap

### P0

- Форма ввода ниши / сайта / ключевых фраз.
- Таблица конкурентов.
- Анализ офферов.
- Оценка рекламной активности.
- Lead capture: Telegram/email.
- CTA на полный аудит.
- Сохранение лида.
- Базовая аналитика событий.
- Согласие на обработку ПДн.
- Legal links near form.
- Backend validation and rate limits.

### P1

- Сравнение посадочных страниц.
- AI-рекомендации.
- Экспорт PDF.
- Telegram-отчет.
- История проверок.
- Браузерное расширение как вспомогательный канал.
- Email/Telegram nurturing.
- Admin view for leads and scans.

### P2

- SERP monitoring.
- Регулярный мониторинг конкурентов.
- Уведомления.
- Расширенная аналитика.
- Интеграция с Яндекс.Директ.
- Multi-region tracking.
- Team/client reports.
- Billing/tripwire payments.

## 9. Frontend Requirements

Required pages/components:

- `frontend/app/lead-magnet`:
  - input form;
  - examples;
  - result preview;
  - lead gate;
  - consent checkbox;
  - CTA to audit.

- `frontend/app/quiz`:
  - optional qualification quiz;
  - niche, budget, channel, site URL, pain.

- `frontend/app/tripwire`:
  - paid low-ticket audit offer;
  - checkout integration later.

- `frontend/app/roi-calculator`:
  - optional calculator for advertising waste/opportunity.

- `frontend/components/marketing-conversion.tsx`:
  - reusable lead capture block;
  - Telegram/email capture;
  - consent copy;
  - analytics hooks.

- `frontend/app/privacy`, `frontend/app/personal-data`, `frontend/app/terms`:
  - legal pages linked from all forms.

Current status: all listed frontend paths are absent in this workspace.

## 10. Backend Requirements

Recommended backend entities:

- `Lead`
  - id, contact_type, contact_value, source, consent_version, consent_at, created_at.

- `CompetitorScan`
  - id, lead_id nullable, input_type, input_value, region, status, created_at.

- `Competitor`
  - id, scan_id, domain, title, description, ad_label, source_type, position, landing_url, captured_at.

- `OfferSignal`
  - id, competitor_id, type, text, confidence.

- `Recommendation`
  - id, scan_id, type, text, priority.

- `AnalyticsEvent`
  - id, anonymous_id/user_id, event_name, properties, created_at.

- `ConsentRecord`
  - id, lead_id, policy_version, consent_text_hash, accepted_at, source.

Required API routes:

- `POST /api/radar/scans`
- `GET /api/radar/scans/:id`
- `POST /api/radar/scans/:id/lead`
- `POST /api/leads`
- `POST /api/analytics/events`
- `GET /api/legal/current-documents`

Current status: only a lightweight Node backend exists, without typed schemas, auth, rate limits, persistent DB, or validation.

## 11. Database Requirements

Required tables:

- `leads`
- `competitor_scans`
- `competitors`
- `offer_signals`
- `recommendations`
- `analytics_events`
- `consent_records`
- `telegram_subscriptions`
- `rate_limit_events` or external Redis-based limiter

Required constraints:

- FK from competitors to scans.
- FK from leads to consent records.
- Required consent before storing contact.
- Unique dedupe keys for competitor scan rows.
- Retention policy fields.

Current status: no Supabase folder/tables/migrations are present. Backend stores JSON in `backend/data/radar.json`, which is suitable only for local prototype.

## 12. Analytics Events

P0 event list:

- `radar_page_view`
- `radar_input_started`
- `radar_scan_submitted`
- `radar_scan_completed`
- `radar_result_viewed`
- `radar_lead_form_viewed`
- `radar_lead_submitted`
- `radar_consent_checked`
- `radar_full_audit_cta_clicked`
- `radar_report_downloaded`
- `radar_error`

Recommended event properties:

- `source`
- `utm_source`, `utm_medium`, `utm_campaign`
- `input_type`
- `niche`
- `region`
- `competitors_count`
- `offers_count`
- `lead_contact_type`
- `consent_version`
- `error_code`

Current status: no analytics event implementation found.

## 13. Security Requirements

Required before public launch:

- Rate limits on scan and lead endpoints.
- CAPTCHA or invisible bot protection for public forms.
- Input validation:
  - max keywords count;
  - max URL length;
  - allowed URL schemes;
  - reject scripts/HTML.
- Output escaping in reports and UI.
- API auth for private/report endpoints.
- CORS restricted to production domains.
- No wildcard CORS in production.
- Request logging without excessive personal data.
- Abuse protection against automated SERP scraping.
- Storage retention policy.
- Avoid storing full raw SERP HTML unless needed and legally reviewed.
- Secrets via env variables, not repo.

Current risks in prototype:

- Backend uses wildcard CORS.
- Demo token is static.
- No rate limits.
- No input validation schemas.
- No production auth.
- JSON-file storage.
- No lead data retention/deletion flow.

## 14. 152-ФЗ / Legal Requirements

This section is product/legal planning, not legal advice. Before launch, final documents should be reviewed by a lawyer.

Requirements for MVP:

- Privacy policy page.
- Personal data processing consent page or modal.
- Consent checkbox near Telegram/email form, unchecked by default.
- Clear processing purpose:
  - provide competitor audit;
  - send report;
  - contact about ДОЖИМ-АИ audit;
  - marketing communications only if separately consented.
- Store only necessary lead data:
  - Telegram username or email;
  - source page;
  - consent timestamp;
  - consent document version.
- Do not collect unnecessary personal data.
- Provide contact/removal process.
- Add cookie notice if analytics/cookies are used.
- Keep records of consent.

Reference points checked during audit:

- 152-ФЗ regulates personal data processing and consent requirements. Public references: ConsultantPlus / Garant versions of Federal Law No. 152-FZ and Roskomнадзор guidance on consent.
- Роскомнадзор guidance states consent should be freely given, specific and informed.
- For internet advertising, 38-ФЗ and Article 18.1 regulate marking/accounting of internet advertising. The Radar product currently analyzes visible third-party `Промо` ads; if ДОЖИМ-АИ publishes its own advertising creatives, separate ad marking/ERIR obligations may apply.

Sources used:

- https://www.consultant.ru/document/cons_doc_LAW_61801/
- https://base.garant.ru/12148567/
- https://42.rkn.gov.ru/p32026/p32474/
- https://www.consultant.ru/document/cons_doc_LAW_502629/2c4537e4796f6ff8b2736ed1b0d4fef08e14458e/

## 15. Implementation Plan

### Phase 1: Product MVP shell

1. Create `frontend/app/lead-magnet`.
2. Add input form:
   - niche;
   - site URL;
   - keywords;
   - region.
3. Add result page/section:
   - competitors table;
   - offers;
   - weaknesses;
   - ideas.
4. Add lead capture:
   - Telegram/email;
   - consent checkbox;
   - legal links.
5. Add CTA to full AI audit.

### Phase 2: Backend schema

1. Replace JSON file backend with DB-backed models.
2. Add scan entity.
3. Add lead entity.
4. Add consent record.
5. Add analytics events.
6. Add validation schemas and rate limits.

### Phase 3: Extension integration

1. Keep extension as acquisition/utility channel.
2. Sync extension scans into backend.
3. Add explicit lead CTA in extension panel.
4. Add Telegram report send.

### Phase 4: Compliance and security

1. Add privacy/personal-data/terms pages.
2. Add cookie notice if analytics/cookies are present.
3. Add retention and deletion flow.
4. Restrict CORS.
5. Add rate limits.
6. Add audit logging.

### Phase 5: Growth funnel

1. Add quiz.
2. Add tripwire audit offer.
3. Add ROI calculator.
4. Add marketing conversion component.
5. Add email/Telegram nurturing.

## 16. Next Codex Prompt

Use this prompt for the next implementation pass:

```text
Ничего не удаляй без подтверждения. На основе COMPETITOR_RADAR_AUDIT.md начни P0 implementation.

Задача:
1. Создай web lead-magnet skeleton для «Радара конкурентов».
2. Если в проекте есть frontend framework, используй его. Если нет, предложи минимальную структуру перед созданием.
3. Добавь форму: ниша, сайт, ключевые фразы, регион.
4. Добавь блок результатов: конкуренты, офферы, слабые места, 3-5 идей.
5. Добавь lead capture: Telegram/email + checkbox согласия на обработку ПДн.
6. Добавь CTA «Получить полный AI-аудит в ДОЖИМ-АИ».
7. Добавь backend endpoints для lead, scan, analytics events.
8. Добавь security basics: validation, rate limit placeholder, restricted CORS config.
9. Добавь legal placeholders: privacy, personal-data, terms.
10. Обнови README.

Не коммить и не пушить без подтверждения.
```

## Files Read During Audit

- `README.md`
- `backend/package.json`
- `backend/server.js`
- `extension/manifest.json`
- `extension/src/background.js`
- `extension/src/shared/storage.js`
- `extension/src/content/yandex-search.js`
- `extension/src/content/wordstat.js`
- `extension/src/popup/popup.html`
- `extension/src/popup/popup.js`
- `extension/src/sidepanel/sidepanel.html`
- `extension/src/sidepanel/sidepanel.js`
- Directory/file existence checks for requested `backend/app/*`, `frontend/*`, `supabase/*`, `MASTER_PRODUCT_SPEC.md`, `PROJECT_AUDIT.md`.
