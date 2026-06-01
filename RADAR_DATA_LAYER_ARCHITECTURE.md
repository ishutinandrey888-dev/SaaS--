# Radar Data Layer Architecture

Дата: 2026-06-01  
Продукт: мини-продукт «Радар конкурентов» для ДОЖИМ-АИ  
Статус: архитектура слоя данных, без runtime-изменений кода

## 1. Executive Summary

Главная ценность «Радара конкурентов» не только в AI-провайдере, а в собственной базе конкурентной разведки: какие домены рекламируются в Яндекс Директ, какие офферы используют, какие CTA повторяются, какие ключи перегреты, где есть свободные точки отстройки.

Рекомендуемая архитектура:

1. **Local-first extension**  
   Расширение даёт пользу сразу: собирает промо-объявления, ключи Wordstat, офферы, CTA, гипотезы и хранит рабочую сводку в `chrome.storage.local`.

2. **Anonymous market sync**  
   Без регистрации можно отправлять только обезличенные рыночные данные: запрос, регион, домен, офферные сигналы, позицию, частотность, intent, timestamp, snapshot hash.

3. **Lead/user layer only after consent**  
   Telegram/email, project_id, user_id и consent-данные отправляются только после явного согласия.

4. **RAG/AI layer later**  
   В RAG попадают нормализованные объявления, офферы, CTA, market summaries, landing summaries и keyword clusters. ПДн, raw user identifiers, email/Telegram, IP не попадают.

5. **No raw HTML by default**  
   Для MVP не храним raw HTML выдачи и не делаем full SERP crawling. Храним нормализованный snapshot и hash.

## 2. Current Implementation Notes

Проанализированы:

- `RADAR_AI_PROVIDER_ANALYSIS.md`
- `COMPETITOR_RADAR_AUDIT.md`
- `extension/manifest.json`
- `extension/src/content/yandex-search.js`
- `extension/src/content/wordstat.js`
- `extension/src/popup/popup.js`
- `extension/src/sidepanel/sidepanel.js`
- `extension/src/shared/storage.js`
- `backend/server.js`

В текущей папке не найдены:

- `supabase/schema.sql`
- `supabase/rls.sql`
- `backend/app/models/competitor.py`
- `backend/app/routers/competitors.py`
- `backend/app/schemas/competitor.py`

Текущий backend — Node JSON storage в `backend/server.js`, не production database. Это нормально для MVP-прототипа, но для коллективной базы нужен Postgres/Supabase слой.

## 3. Data From Yandex Search

Расширение может собирать из Яндекс Поиска:

| Поле | Назначение | Privacy level |
|---|---|---|
| `searchQuery` | исходный поисковый запрос | anonymous market |
| `region` | регион выдачи, если доступен/выбран | anonymous market |
| `capturedAt` | timestamp проверки | anonymous market |
| `adPosition` | позиция промо-объявления на странице | anonymous market |
| `domain` | домен рекламодателя | anonymous market |
| `realHeadline` | настоящий заголовок объявления | anonymous market |
| `displayUrl` | отображаемая ссылка/breadcrumb | anonymous market |
| `description` | текст объявления | anonymous market |
| `sitelinks[]` | быстрые ссылки | anonymous market |
| `cta` | извлечённый CTA | anonymous market |
| `detectedOfferTypes[]` | скидка, гарантия, цена и т.д. | anonymous market |
| `priceSignals[]` | цена, диапазон, смета | anonymous market |
| `guaranteeSignals[]` | гарантия, договор, без риска | anonymous market |
| `urgencySignals[]` | срочность, срок, акция | anonymous market |
| `leadMagnetSignals[]` | консультация, замер, квиз, калькулятор | anonymous market |
| `landingUrl` | URL посадочной/клика, лучше нормализовать | anonymous market / protected if full URL contains ids |
| `serpSnapshotHash` | hash нормализованной выдачи | anonymous market |
| `sourcePage` | `yandex_search` | anonymous market |
| `parserVersion` | версия алгоритма извлечения | operational |

Что важно:

- Full landing URL может содержать UTM, click IDs и потенциально пользовательские параметры. Для anonymous sync лучше хранить `domain`, `pathHash`, `utmKeys[]`, но не полный URL, если нет отдельного основания.
- Raw HTML выдачи не хранить в MVP.

## 4. Data From Wordstat

Расширение может собирать из Wordstat:

| Поле | Назначение | Privacy level |
|---|---|---|
| `keyword` | ключевая фраза | anonymous market |
| `frequency` | частотность | anonymous market |
| `parentQuery` | исходный запрос Wordstat | anonymous market |
| `intent` | commercial / informational / brand / geo / mixed | anonymous market |
| `geoModifier` | Москва, СПб, район, рядом | anonymous market |
| `commercialModifier` | купить, цена, заказать, под ключ | anonymous market |
| `negativeKeywordCandidate` | кандидат в минус-слова | anonymous market |
| `clusterCandidate` | будущий кластер | anonymous market |
| `campaignGroupCandidate` | подсказка группы объявлений | anonymous market |
| `capturedAt` | timestamp | anonymous market |
| `sourcePage` | `wordstat` | anonymous market |
| `parserVersion` | версия алгоритма | operational |

## 5. Data Levels

### A. Local-only data

Хранится только в `chrome.storage.local`, не отправляется на backend по умолчанию.

- `activeProject`
- `latestScan`
- локальные competitors/keywords до сохранения;
- UI-настройки;
- `apiBaseUrl`;
- `appBaseUrl`;
- локальный `syncStatus`;
- временные debug snippets;
- full raw page text/debug DOM вокруг `Промо`;
- export state.

Причина: это рабочее пространство пользователя, там могут оказаться чувствительные контексты, внутренние названия проектов и ручные заметки.

### B. Anonymous market data

Можно отправлять без регистрации, если:

- нет email/Telegram/user id;
- нет IP как бизнес-поля;
- нет raw HTML;
- нет полного URL с персональными параметрами;
- есть понятное disclosure в privacy/cookie policy.

Примеры:

- search query;
- region;
- domain;
- realHeadline;
- description;
- normalized sitelinks;
- offer/CTA/strategy signals;
- keyword/frequency/intent;
- anonymous installation id, если нужен dedup, но лучше hashed rotating id;
- snapshot hash.

### C. Lead/user data

Отправлять только после согласия:

- email;
- Telegram;
- project_id;
- user_id;
- consent_version;
- consent_at;
- source;
- funnel_step.

### D. Sensitive/protected data

Не отправлять без отдельного согласия и не хранить в расширении без необходимости:

- доступы к рекламным кабинетам;
- токены Яндекс Директ;
- client IDs, campaign IDs, budget data пользователя;
- внутренние CRM/лиды клиента;
- raw HTML личных кабинетов;
- персональные данные из страниц/URL;
- phone/email, найденные на посадочных, без clear purpose.

## 6. Database Entities

### 6.1 `radar_scans`

Назначение: единица проверки SERP/Wordstat.

Поля:

- `id uuid pk`
- `source text` — `yandex_search`, `wordstat`, `manual`, `backend`
- `scan_type text` — `serp`, `wordstat`, `landing`, `mixed`
- `query text`
- `region text`
- `project_id uuid null`
- `anonymous_session_hash text null`
- `user_id uuid null`
- `parser_version text`
- `snapshot_hash text`
- `competitors_count int`
- `keywords_count int`
- `status text`
- `created_at timestamptz`

Индексы:

- `(source, scan_type, created_at desc)`
- `(query, region, created_at desc)`
- `(snapshot_hash)`
- `(project_id, created_at desc)`

Retention:

- anonymous raw scan metadata: 12-24 месяца;
- user-linked scans: пока активен аккаунт + удаление по запросу.

Privacy level: mixed.  
RLS: да.

### 6.2 `radar_competitors`

Назначение: нормализованные промо-объявления конкурентов.

Поля:

- `id uuid pk`
- `scan_id uuid fk`
- `project_id uuid null`
- `domain text`
- `display_url text`
- `landing_url_hash text null`
- `real_headline text`
- `description text`
- `position int`
- `query text`
- `region text`
- `is_promo boolean`
- `ad_label text`
- `primary_offer text`
- `usp text`
- `cta text`
- `strategy text`
- `strengths jsonb`
- `weaknesses jsonb`
- `missing_triggers jsonb`
- `differentiation_point text`
- `hypothesis text`
- `quality_score int`
- `captured_at timestamptz`

Индексы:

- `(domain, captured_at desc)`
- `(query, region, position)`
- `(strategy, captured_at desc)`
- `gin(strengths)`, `gin(weaknesses)` при необходимости.

Retention:

- anonymous market: 24 месяца;
- user-linked: по жизненному циклу проекта.

Privacy level: anonymous market / user-linked copy.  
RLS: да.

### 6.3 `radar_offer_signals`

Назначение: атомарные сигналы офферов и триггеров.

Поля:

- `id uuid pk`
- `competitor_id uuid fk`
- `signal_group text` — offer, price, urgency, guarantee, lead_magnet, cta, geo, trust
- `signal text`
- `evidence text`
- `confidence numeric`
- `source_field text` — headline, description, sitelink
- `created_at timestamptz`

Индексы:

- `(signal_group, signal)`
- `(competitor_id)`
- `(created_at desc)`

Retention: как у `radar_competitors`.  
Privacy level: anonymous market.  
RLS: да.

### 6.4 `radar_keywords`

Назначение: нормализованные ключи Wordstat.

Поля:

- `id uuid pk`
- `scan_id uuid fk`
- `project_id uuid null`
- `keyword text`
- `frequency int`
- `parent_query text`
- `intent text`
- `geo_modifier text null`
- `commercial_modifier text null`
- `negative_keyword_candidate boolean`
- `cluster_candidate text null`
- `campaign_group_candidate text null`
- `signals jsonb`
- `captured_at timestamptz`

Индексы:

- `(keyword, captured_at desc)`
- `(parent_query, captured_at desc)`
- `(intent, frequency desc)`
- `(project_id, captured_at desc)`

Retention: 24 месяца anonymous, project lifecycle for user data.  
Privacy level: anonymous market.  
RLS: да.

### 6.5 `radar_keyword_clusters`

Назначение: кластеры ключей для кампаний и RAG.

Поля:

- `id uuid pk`
- `project_id uuid null`
- `niche text`
- `region text`
- `cluster_name text`
- `intent text`
- `keywords jsonb`
- `total_frequency int`
- `minus_words jsonb`
- `campaign_group_hint text`
- `created_at timestamptz`
- `updated_at timestamptz`

Индексы:

- `(niche, region)`
- `(intent, total_frequency desc)`
- `(project_id)`

Retention: 24 месяца / user lifecycle.  
Privacy level: anonymous market or user.  
RLS: да.

### 6.6 `radar_market_summaries`

Назначение: агрегированные инсайты по нише/региону.

Поля:

- `id uuid pk`
- `niche text`
- `region text`
- `period_start date`
- `period_end date`
- `top_domains jsonb`
- `top_offers jsonb`
- `top_ctas jsonb`
- `top_strategies jsonb`
- `overheated_queries jsonb`
- `differentiation_gaps jsonb`
- `sample_size int`
- `created_at timestamptz`

Индексы:

- `(niche, region, period_end desc)`
- `(period_end desc)`

Retention: long-term, because aggregated.  
Privacy level: aggregate anonymous.  
RLS: можно public read для платного API или service-role only.

### 6.7 `radar_leads`

Назначение: лиды из extension/web lead magnet.

Поля:

- `id uuid pk`
- `project_id uuid null`
- `scan_id uuid null`
- `contact text`
- `contact_type text` — email, telegram
- `source text`
- `funnel_step text`
- `consent_id uuid`
- `status text`
- `created_at timestamptz`

Индексы:

- `(contact_type, contact)`
- `(source, created_at desc)`
- `(project_id, created_at desc)`

Retention: по privacy policy, например до отзыва согласия или 3 года с последнего контакта.  
Privacy level: personal data.  
RLS: строго да.

### 6.8 `radar_consents`

Назначение: доказуемая фиксация согласий.

Поля:

- `id uuid pk`
- `lead_id uuid null`
- `user_id uuid null`
- `consent_type text`
- `consent_version text`
- `consent_text_hash text`
- `accepted boolean`
- `accepted_at timestamptz`
- `source text`
- `ip_hash text null`
- `user_agent_hash text null`

Индексы:

- `(lead_id)`
- `(user_id)`
- `(consent_type, accepted_at desc)`

Retention: срок действия согласия + срок защиты прав.  
Privacy level: personal/legal.  
RLS: строго да.

### 6.9 `radar_events`

Назначение: продуктовая аналитика extension/web.

Поля:

- `id uuid pk`
- `event_name text`
- `source text`
- `anonymous_session_hash text null`
- `user_id uuid null`
- `project_id uuid null`
- `scan_id uuid null`
- `properties jsonb`
- `created_at timestamptz`

Индексы:

- `(event_name, created_at desc)`
- `(source, created_at desc)`
- `(project_id, created_at desc)`

Retention:

- detailed events: 6-12 месяцев;
- aggregated events: дольше.

Privacy level: anonymous/user-linked.  
RLS: да.

### 6.10 `radar_snapshots`

Назначение: контроль изменений выдачи без хранения raw HTML.

Поля:

- `id uuid pk`
- `scan_id uuid fk`
- `snapshot_hash text`
- `normalized_items_hash text`
- `query text`
- `region text`
- `item_count int`
- `parser_version text`
- `created_at timestamptz`

Индексы:

- `(snapshot_hash)`
- `(query, region, created_at desc)`

Retention: 12 месяцев.  
Privacy level: anonymous market.  
RLS: да.

### 6.11 `radar_rag_documents`

Назначение: документы для RAG/semantic search.

Поля:

- `id uuid pk`
- `source_entity_type text`
- `source_entity_id uuid`
- `doc_type text` — ad, offer, market_summary, landing_summary, keyword_cluster
- `content text`
- `metadata jsonb`
- `embedding vector`
- `embedding_provider text`
- `embedding_model text`
- `content_hash text`
- `created_at timestamptz`
- `updated_at timestamptz`

Индексы:

- vector index на `embedding`;
- `(doc_type, created_at desc)`
- `(content_hash)`
- `gin(metadata)`.

Retention: пока актуален source entity; пересбор при изменении parser/model.  
Privacy level: anonymous/aggregate only.  
RLS: service-role only для записи, gated read.

## 7. Radar Collective Intelligence

Из anonymous market data строится коллективная база:

### По нишам

- топ офферов;
- топ CTA;
- типичные стратегии;
- средняя плотность конкуренции;
- частые слабые места.

### По регионам

- региональные домены-лидеры;
- гео-модификаторы;
- отличия офферов Москва / регионы;
- локальные точки отстройки.

### По доменам

- частота появления;
- запросы, где домен рекламируется;
- изменение headline/CTA;
- усиление/ослабление активности.

### По офферам

- какие офферы чаще встречаются;
- какие появляются чаще со временем;
- какие триггеры редкие, но потенциально сильные.

### По времени

- появление новых конкурентов;
- сезонные офферы;
- рост CTA/лид-магнитов;
- перегретые запросы.

Будущие инсайты:

- «В нише ремонта 68% рекламодателей обещают бесплатный замер, но только 14% дают гарантию сметы».
- «CTA “рассчитать стоимость” растёт быстрее, чем “оставить заявку”».
- «Домен X начал показываться по 12 новым коммерческим запросам».
- «Запросы с “цена” перегреты, но в geo-long-tail меньше конкурентов».
- «Свободная точка отстройки: гарантия срока + прозрачная смета».

## 8. RAG Layer

### Что попадает в RAG

- нормализованные объявления;
- realHeadline + description + CTA;
- primary offer / USP / strategy;
- offer signals;
- market summaries;
- landing page summaries;
- Wordstat clusters;
- aggregated trend summaries.

### Что не попадает в RAG

- email;
- Telegram;
- IP;
- user IDs;
- raw personal data;
- raw HTML личных кабинетов;
- campaign/account tokens;
- полные URL с пользовательскими идентификаторами.

### Document format

```json
{
  "docType": "ad",
  "content": "Ниша: ремонт квартир. Регион: Москва. Домен: example.ru. Заголовок: ... Оффер: ... CTA: ... Стратегия: trust-led.",
  "metadata": {
    "niche": "ремонт квартир",
    "region": "Москва",
    "domain": "example.ru",
    "strategy": "trust-led",
    "signals": ["гарантия", "расчет/смета"],
    "source": "yandex_search",
    "capturedAt": "2026-06-01"
  }
}
```

### Chunking

- Ad document: 1 объявление = 1 chunk.
- Market summary: 1 niche-region-period = 1 chunk.
- Landing summary: 1 landing/domain snapshot = 1 chunk.
- Keyword cluster: 1 cluster = 1 chunk.

### Embeddings

MVP: embeddings не нужны.  
V2:

- GigaChat embeddings для RF-friendly слоя;
- Qwen/DeepSeek/self-host embeddings как cost experiments;
- pgvector в Supabase/Postgres.

### Similarity search

Сценарии:

- похожие офферы в нише;
- похожие CTA;
- похожие стратегии;
- поиск свободной точки отстройки;
- «что тестировали конкуренты в похожих нишах».

### Update frequency

- new scan: сразу нормализуем и кладём в source tables;
- RAG documents: async job каждые 5-15 минут или batch daily;
- market summaries: daily/weekly.

## 9. Event Analytics

События:

- `radar_extension_opened`
- `radar_serp_scan_started`
- `radar_serp_scan_completed`
- `radar_wordstat_scan_started`
- `radar_wordstat_scan_completed`
- `radar_competitor_saved`
- `radar_offer_detected`
- `radar_ai_insight_viewed`
- `radar_lead_gate_shown`
- `radar_lead_submitted`
- `radar_saas_cta_clicked`
- `radar_backend_sync_failed`

Минимальная схема event:

```json
{
  "eventName": "radar_serp_scan_completed",
  "source": "browser_extension",
  "anonymousSessionHash": "optional_rotating_hash",
  "projectId": "optional_after_consent_or_login",
  "scanId": "optional",
  "properties": {
    "query": "ремонт квартир москва",
    "region": "Москва",
    "competitorsCount": 9,
    "offers": ["цена", "гарантия"]
  },
  "createdAt": "2026-06-01T00:00:00Z"
}
```

Для anonymous events не отправлять email/Telegram/userId.

## 10. Compliance / 152-ФЗ

### Не являются ПДн сами по себе

- поисковый запрос по нише;
- домен конкурента;
- текст публичного рекламного объявления;
- публичная частотность Wordstat;
- агрегированный market summary.

### Могут стать ПДн

- email;
- Telegram handle;
- user_id;
- IP/user-agent в связке с лидом;
- project name, если пользователь вводит ФИО/телефон/внутренний клиентский контекст;
- landing URL, если содержит user/click identifiers.

### Как получать согласие

- чекбокс рядом с lead capture;
- ссылки на privacy, personal-data, terms;
- хранить `consent_version`, `consent_text_hash`, `consent_at`, `source`;
- не ставить consent checkbox pre-checked.

### Минимизация

- anonymous sync без контактных данных;
- не хранить raw HTML;
- не хранить полные URL с click IDs;
- не отправлять ПДн в foreign AI;
- для RAG использовать только обезличенный/публичный/агрегированный контент.

### Удаление данных

Нужно предусмотреть:

- удаление lead/user records;
- удаление user-linked projects/scans;
- сохранение агрегированной anonymous статистики, если она не позволяет идентифицировать пользователя.

### Privacy policy

В policy нужно явно описать:

- что расширение собирает публичные рекламные данные;
- что часть данных может отправляться обезличенно;
- что контакты отправляются только после согласия;
- как отключить sync;
- как запросить удаление;
- какие AI-провайдеры используются и что в них не отправляются ПДн без основания.

## 11. API Design

### `POST /radar/scans`

Создать scan.

Anonymous allowed: да.  
Auth required: нет для anonymous market scan, да для project-linked scan.  
Rate limit: 12/min anonymous, 60/min authenticated.

Request:

```json
{
  "source": "yandex_search",
  "scanType": "serp",
  "query": "ремонт квартир москва",
  "region": "Москва",
  "parserVersion": "extension-0.2.0",
  "snapshotHash": "sha256..."
}
```

Response:

```json
{
  "scan": {
    "id": "uuid",
    "status": "accepted"
  }
}
```

Validation:

- `source` enum;
- `scanType` enum;
- query max 200 chars;
- no raw HTML.

### `POST /radar/competitors`

Сохранить обезличенные объявления.

Anonymous allowed: да.  
Auth required: опционально.  
Rate limit: 60 items/min anonymous.

Request:

```json
{
  "scanId": "uuid",
  "items": [
    {
      "domain": "example.ru",
      "realHeadline": "Ремонт квартир в Москве",
      "displayUrl": "example.ru › remont",
      "description": "Гарантия 3 года...",
      "position": 1,
      "query": "ремонт квартир москва",
      "isPromo": true,
      "sitelinks": [
        {"title": "Цены", "role": "price"}
      ],
      "cta": "рассчитать",
      "strategy": "price-led",
      "priceSignals": ["конкретная цена"],
      "guaranteeSignals": ["гарантия"]
    }
  ]
}
```

Response:

```json
{
  "itemsSaved": 1
}
```

### `POST /radar/keywords`

Сохранить Wordstat keywords.

Anonymous allowed: да.  
Rate limit: 200 items/min anonymous.

Request:

```json
{
  "scanId": "uuid",
  "items": [
    {
      "keyword": "ремонт квартир цена",
      "frequency": 6400,
      "parentQuery": "ремонт квартир",
      "intent": "commercial",
      "commercialModifier": "цена",
      "negativeKeywordCandidate": false,
      "clusterCandidate": "цены",
      "campaignGroupCandidate": "цена/стоимость"
    }
  ]
}
```

Response:

```json
{
  "itemsSaved": 1
}
```

### `POST /radar/events`

Product analytics.

Anonymous allowed: да.  
Rate limit: 180/min.

Request:

```json
{
  "eventName": "radar_competitor_saved",
  "source": "browser_extension",
  "properties": {
    "query": "ремонт квартир",
    "count": 9
  }
}
```

Response:

```json
{
  "event": {
    "id": "uuid"
  }
}
```

### `POST /radar/leads`

Lead capture.

Anonymous allowed: да, но только consent.  
Rate limit: 8/min.

Request:

```json
{
  "contact": "@username",
  "contactType": "telegram",
  "source": "extension_soft_gate",
  "consentAccepted": true,
  "consentVersion": "2026-06-01",
  "context": {
    "scanId": "uuid",
    "query": "ремонт квартир"
  }
}
```

Response:

```json
{
  "lead": {
    "id": "uuid",
    "status": "created"
  }
}
```

### `GET /radar/market-summary`

Получить агрегированный summary.

Anonymous allowed: можно для preview с лимитами.  
Auth required: для full summary.

Query params:

- `niche`
- `region`
- `period`

Response:

```json
{
  "summary": {
    "topOffers": [],
    "topCtas": [],
    "topStrategies": [],
    "differentiationGaps": []
  }
}
```

### `GET /radar/competitors/by-domain`

История домена.

Auth required: да для полного доступа.  
Anonymous preview: только aggregate.

Query:

- `domain`
- `region`
- `period`

### `GET /radar/offers/by-niche`

Офферы по нише.

Anonymous allowed: preview.  
Auth required: full.

Query:

- `niche`
- `region`
- `period`

### `POST /radar/rag/query`

AI/RAG вопрос к базе.

Auth required: да.  
Rate limit: по тарифу.

Request:

```json
{
  "question": "Какая свободная точка отстройки в ремонте квартир в Москве?",
  "niche": "ремонт квартир",
  "region": "Москва"
}
```

Response:

```json
{
  "answer": "...",
  "sources": [
    {"docId": "uuid", "domain": "example.ru"}
  ]
}
```

## 12. MVP Recommendation

Делаем в MVP:

- local rules в extension;
- local summary в `chrome.storage.local`;
- anonymous scan sync:
  - scans;
  - competitors;
  - offer signals;
  - keywords;
  - events;
- lead capture с consent;
- базовый market summary по нише/региону;
- строгая минимизация URL/raw данных;
- backend validation/rate limits.

## 13. V2 Recommendation

Делаем в V2:

- Supabase/Postgres schema + RLS;
- embeddings / pgvector;
- RAG по объявлениям, офферам, market summaries;
- trend detection;
- monitoring по выбранным запросам;
- landing enrichment через backend;
- Telegram/email report;
- paid limits.

## 14. Что откладываем

- full SERP crawling;
- хранение raw HTML;
- foreign AI для ПДн;
- real-time monitoring;
- прямой доступ extension к рекламным кабинетам;
- хранение токенов Яндекс Директ в extension;
- сложный антифрод до появления трафика.

## 15. Next Engineering Tasks

1. Добавить в backend endpoints:
   - `POST /radar/competitors`
   - `POST /radar/keywords`
   - `GET /radar/market-summary`
2. Обновить validation, чтобы backend принимал V2 поля:
   - `realHeadline`
   - `displayUrl`
   - `sitelinks`
   - `cta`
   - `strategy`
   - `offerSignals`
   - `priceSignals`
   - `guaranteeSignals`
   - `urgencySignals`
   - `leadMagnetSignals`
3. Добавить anonymous sync mode отдельно от project sync.
4. Спроектировать Supabase migration для таблиц из раздела 6.
5. Обновить privacy/personal-data тексты под anonymous market data.
6. Добавить event taxonomy в README/EXTENSION_README.
7. После первых 100-300 scans построить первый `radar_market_summaries`.
