# RADAR AI Provider Analysis

Дата: 2026-06-01

Документ анализирует AI-провайдеров для мини-продукта «Радар конкурентов»: браузерного расширения для Яндекс Поиска, Wordstat и будущей интеграции с Яндекс Директ.

## 1. Executive Summary

Лучшая архитектура для «Радара конкурентов» — гибридная:

1. **Free local engine в extension** для базового анализа без API:
   - офферы;
   - CTA;
   - intent ключей;
   - простые гипотезы;
   - первичная кластеризация.

2. **Cheap AI provider на backend** для массовых запросов:
   - основной кандидат: **GigaChat Lite/Pro** для РФ-комплаенса и русского языка;
   - альтернативный дешевый кандидат: **DeepSeek Chat** или **Qwen Flash/Max** через backend, если юридически допустимо.

3. **Premium AI provider только после лида / в SaaS**:
   - **Claude / OpenAI** для полного аудита, сложных стратегических выводов и красивых отчетов;
   - использовать не в extension напрямую, а только backend-side.

Главная рекомендация:

- **В extension не вызывать AI напрямую.** Только правила + локальная эвристика.
- **Для MVP**: local rules + GigaChat Lite/Pro на backend для дешевого AI-обогащения после сохранения в сводку.
- **Для полного AI-аудита**: Claude или OpenAI как premium-слой.
- **DeepSeek/Qwen/Kimi/GLM** держать как cost fallback / экспериментальный слой, но не завязывать на них РФ-compliance в MVP.

## 2. Use Cases For Radar

### Extension: Яндекс Поиск

Задачи:

- классификация офферов;
- извлечение CTA;
- определение стратегии конкурента;
- генерация 1-2 быстрых гипотез;
- сохранение конкурента в сводку;
- переход в SaaS.

Требования:

- моментальная скорость;
- низкая стоимость;
- работа без логина;
- не раскрывать API-ключи в расширении.

Вывод: эти задачи должны выполняться локально правилами. AI нужен только для улучшенной версии отчета.

### Extension: Wordstat

Задачи:

- intent запросов;
- выделение коммерческих ключей;
- минус-слова;
- смежные ниши;
- высокий потенциал;
- базовая группировка ключей.

Вывод: 70-80% пользы можно сделать правилами. AI нужен для кластеризации, названий групп и генерации структуры кампаний.

### SaaS: полный аудит

Задачи:

- анализ всех конкурентов;
- поиск повторяющихся офферов;
- стратегия конкурентов;
- слабые места;
- рекламные гипотезы;
- структура кампаний;
- RAG по истории конкурентов;
- PDF/HTML-отчет.

Вывод: здесь нужен AI, но только после лида или регистрации.

## 3. Provider Comparison Table

| Provider | Цена | Русский язык | Анализ рекламы | JSON / tools | Embeddings | Self-host | РФ compliance | Риск блокировок | Extension suitability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| YandexGPT / AI Studio | Средняя | Отлично | Хорошо для РФ | Есть API, инструменты в AI Studio | Есть | Нет | Высокая | Низкий в РФ | Хорошо через backend |
| GigaChat | Низкая/средняя | Отлично | Хорошо | Function calling, structured output beta | Есть | Нет | Высокая | Низкий в РФ | Хорошо через backend |
| OpenAI | Средняя/высокая | Отлично | Отлично | Лучший structured output/tooling | Есть | Нет | Средний/низкий для РФ | Средний | Только backend |
| Claude | Высокая | Отлично | Отлично | Tool use, structured output | Нет нативных embeddings | Нет | Средний/низкий для РФ | Средний | Только premium backend |
| Kimi | Низкая/средняя | Хорошо | Хорошо | JSON mode/tools | Ограниченно/проверять | Нет | Низкая/средняя | Средний | Backend fallback |
| Qwen | Низкая | Хорошо | Хорошо | OpenAI-compatible, tools/JSON у многих моделей | Есть | Да, OSS веса | Низкая/средняя | Средний | Backend/self-host fallback |
| GLM | Низкая/средняя | Нормально/хорошо | Средне/хорошо | Tools/structured у новых моделей | Есть/проверять | Частично | Низкая/средняя | Средний | Экспериментально |
| DeepSeek | Очень низкая | Хорошо | Хорошо | JSON/tools зависят от модели | Нет/через сторонние | Да, OSS веса | Низкая/средняя | Средний | Cheap backend fallback |

## 4. Cost Comparison

Цены быстро меняются, поэтому ниже — ориентиры на момент подготовки документа.

### YandexGPT / AI Studio

Yandex AI Studio тарифицирует по input/output tokens. В документации указан YandexGPT Pro async около `$0.0050` за 1 000 токенов, а русская страница показывает YandexGPT Pro 5.1 около `0,82 ₽` за 1 000 input/output tokens в синхронном режиме. Yandex Cloud также указывает, что инфраструктура защищена в соответствии с 152-ФЗ. Источники: Yandex AI Studio pricing/docs и terms lines про 152-ФЗ. [Yandex AI Studio docs](https://aistudio.yandex.ru/docs/en/) и [Yandex pricing](https://yandex.cloud/ru/docs/ai-studio/pricing).

### GigaChat

Для юрлиц:

- GigaChat Lite sync: `0,065 ₽ / 1 000 tokens`;
- GigaChat Lite async: `0,0325 ₽ / 1 000 tokens`;
- GigaChat Pro sync: `0,5 ₽ / 1 000 tokens`;
- GigaChat Pro async: `0,25 ₽ / 1 000 tokens`;
- GigaChat Max sync: `0,65 ₽ / 1 000 tokens`;
- embeddings sync: `0,014 ₽ / 1 000 tokens`;
- embeddings async: `0,007 ₽ / 1 000 tokens`.

Источник: [Sber GigaChat tariffs for legal entities](https://developers.sber.ru/docs/ru/gigachat/tariffs/legal-tariffs).

### OpenAI

На официальной странице pricing:

- GPT-5.4 mini: `$0.75 / 1M input`, `$4.50 / 1M output`;
- GPT-5.4: `$2.50 / 1M input`, `$15 / 1M output`;
- GPT-5.5: `$5 / 1M input`, `$30 / 1M output`;
- Batch API дает `-50%`;
- Web search tool стоит `$10 / 1k calls`.

Источник: [OpenAI API pricing](https://openai.com/api/pricing/).

### Claude

Claude обычно дороже дешевых open-source/API моделей, но силен для качественного анализа и отчетов. В документации указаны tool/web-search особенности: web search `$10 / 1k searches` плюс token costs; web fetch без отдельной платы, но контент считается токенами. Источник: [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing).

### DeepSeek

Официальная pricing-страница:

- deepseek-chat: cache hit input `$0.07 / 1M`, cache miss input `$0.27 / 1M`, output `$1.10 / 1M`;
- deepseek-reasoner: cache hit input `$0.14 / 1M`, cache miss input `$0.55 / 1M`, output `$2.19 / 1M`.

Источник: [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing-details-usd).

### Qwen

Alibaba Cloud Model Studio:

- qwen3-max international: от `$1.2 / 1M input`, `$6 / 1M output`, есть free quota `1M tokens each` на 90 дней после активации;
- qwen-max global: около `$0.345 / 1M input`, `$1.377 / 1M output`;
- batch invocation для поддерживаемых моделей — 50% от real-time цены.

Источник: [Alibaba Cloud Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing).

### Kimi

Kimi/Moonshot тарифицирует input/output tokens, поддерживает context caching, web search fee `$0.004 per invocation` по help center, а подробные цены вынесены в model pricing pages. Также заявлены ToolCalls, JSON Mode, Partial Mode и web search у Kimi K models. Источники: [Kimi API pricing help](https://www.kimi.com/help/kimi-api/api-pricing), [Kimi model pricing docs](https://platform.kimi.ai/docs/pricing/chat).

### GLM

GLM/Zhipu выглядит перспективно по цене и tool-calling у новых моделей, но для MVP данных по стабильной международной тарификации и compliance меньше. Лучше держать как experimental fallback, не как основной слой.

## 5. Russian Language Quality

Оценка для рекламных задач на русском:

1. **YandexGPT**: очень сильный русский и локальный контекст РФ.
2. **GigaChat**: сильный русский, хорош для РФ-бизнеса, приемлемая стоимость.
3. **OpenAI / Claude**: очень высокое качество рассуждений и копирайтинга, но не РФ-first.
4. **DeepSeek / Qwen / Kimi**: хороший русский, особенно для структурных задач, но рекламные нюансы РФ требуют тестов.
5. **GLM**: можно тестировать, но не ставить первым выбором.

## 6. Extension Suitability

В браузерном расширении нельзя безопасно хранить API keys. Поэтому:

- AI-вызовы напрямую из extension не делать;
- ключи провайдеров держать только на backend;
- extension должен работать без AI;
- AI-анализ запускать после сохранения в сводку, регистрации или заявки.

Подходящие задачи для extension без AI:

- regex/rules offer detection;
- intent rules;
- frequency sorting;
- simple clustering by modifiers;
- CTA detection;
- local report.

Неподходящие задачи для extension без backend:

- premium AI report;
- RAG;
- embeddings;
- multi-page SERP crawling;
- long history monitoring.

## 7. Embeddings / RAG Options

### Для MVP

Embeddings не нужны. Можно хранить:

- normalized domain;
- title;
- description;
- detectedOffers;
- query;
- frequency;
- intent.

Поиск похожих офферов сделать rules/string similarity.

### Для V2

Embeddings нужны для:

- похожих офферов;
- похожих конкурентов;
- истории изменений;
- RAG по базе конкурентов;
- кластеризации объявлений.

Рекомендации:

1. **GigaChat embeddings** для РФ stack: дешево, русский язык, legal-friendly.
2. **OpenAI embeddings** для качества/стабильности, если compliance позволяет.
3. **Qwen embeddings** как cheap fallback.
4. **Self-host bge-m3 / multilingual-e5** при росте и желании контролировать стоимость.

## 8. Free / Cheap Architecture

### Free local engine в extension

Что делает:

- офферы: скидка, цена, гарантия, рассрочка, срочность, гео;
- intent Wordstat;
- минус-слова;
- высокий потенциал;
- базовые гипотезы;
- локальная сводка.

Стоимость: `0`.

Ограничение: выводы простые, но для lead magnet достаточно.

### Cheap AI provider

Массовые задачи:

- улучшить формулировку инсайта;
- сгруппировать ключи;
- дать 3-5 идей объявлений;
- определить стратегию конкурента;
- подготовить черновик кампании.

Лучшие кандидаты:

- GigaChat Lite/Pro;
- DeepSeek Chat;
- Qwen Flash/Max.

### Premium AI

Использовать только:

- после лида;
- после регистрации;
- при запросе полного отчета;
- в paid SaaS.

Кандидаты:

- Claude;
- OpenAI.

## 9. Hybrid Architecture

```text
Extension
  ├─ Local rules engine
  ├─ Local storage / chrome.storage
  ├─ Сводка
  └─ CTA в SaaS

Backend
  ├─ Auth / projects / leads
  ├─ AI router
  ├─ Cheap model: GigaChat / DeepSeek / Qwen
  ├─ Premium model: Claude / OpenAI
  ├─ Embeddings provider
  └─ Reports / history / monitoring
```

AI router должен выбирать модель по задаче:

- `offer_classification`: local first, cheap AI optional;
- `keyword_clustering`: cheap AI;
- `campaign_structure`: cheap AI or premium if paid;
- `full_audit`: premium AI;
- `rag_answer`: embeddings + premium/cheap depending on tariff.

## 10. Compliance / 152-ФЗ Risks

### Low risk

- local analysis in extension;
- no personal data;
- backend in РФ;
- YandexGPT/GigaChat;
- хранение только email/Telegram + consent.

### Medium risk

- OpenAI/Claude/DeepSeek/Qwen/Kimi/GLM with business data;
- передача текстов объявлений, доменов, ключей за рубеж;
- отсутствие DPA/локализации.

### Recommendation

Для РФ MVP:

- персональные данные не отправлять в foreign AI;
- extension AI не вызывать напрямую;
- для PII и lead-flow использовать backend в РФ;
- full report can use foreign AI only after explicit terms/consent and without unnecessary PII.

## 11. Recommended MVP Stack

### Extension

- Local rules only.
- No AI keys.
- No direct AI calls.
- Save to summary.
- Soft gate after value is shown.

### Backend

- GigaChat Lite/Pro as primary cheap AI for Russian market.
- DeepSeek Chat as optional cost fallback if compliance permits.
- GigaChat embeddings later.

### SaaS full report

- Claude/OpenAI as premium provider for high-quality strategic report.
- GigaChat Pro as РФ-safe fallback.

MVP provider choice:

1. **Primary**: local rules.
2. **Cheap AI**: GigaChat Lite/Pro.
3. **Fallback cheap**: DeepSeek Chat or Qwen.
4. **Premium**: Claude/OpenAI.

## 12. Recommended V2 Stack

For 100 users:

- local rules;
- GigaChat Lite/Pro for AI enrichment;
- no embeddings unless paid report.

For 1 000 users:

- local rules;
- AI batching;
- cache repeated queries;
- embeddings for saved competitors;
- cheap model for clustering;
- premium model only after lead.

For 10 000 users:

- rules in extension;
- backend queue;
- provider router;
- cache by query+region+date;
- self-host embeddings or GigaChat embeddings;
- premium audit paid/lead-limited only.

## 13. Implementation Plan

### Phase 1: No-AI MVP

- Keep current rule engine in extension.
- Improve offer dictionary.
- Improve Wordstat intent rules.
- Add local campaign structure draft.
- Add usage counters.

### Phase 2: Backend AI Router

Endpoints:

- `POST /ai/offer-analysis`
- `POST /ai/keyword-clusters`
- `POST /ai/campaign-draft`
- `POST /ai/full-audit`

Router:

- local/rules response if quota exhausted;
- GigaChat for cheap enrichment;
- premium provider for full audit.

### Phase 3: Caching and Limits

Cache keys:

- `search:{query}:{region}:{date}`;
- `wordstat:{query}:{region}:{month}`;
- `audit:{projectId}:{scanHash}`.

Limits:

- anonymous: 3 saves/day, no AI;
- lead captured: 3 cheap AI enrichments;
- registered: 10 cheap AI enrichments/month;
- paid: full audit + monitoring.

### Phase 4: RAG

- Store competitor snapshots.
- Add embeddings.
- Add similarity search.
- Add trend/change detection.

## 14. Next Engineering Tasks

1. Add AI provider abstraction:
   - `AiProvider` interface;
   - `GigaChatProvider`;
   - `DeepSeekProvider`;
   - `OpenAIProvider`;
   - provider router.

2. Add schemas:
   - offer analysis JSON schema;
   - keyword cluster schema;
   - campaign draft schema;
   - full audit schema.

3. Add cost guardrails:
   - per-user quota;
   - per-project quota;
   - max tokens;
   - timeout;
   - retry/fallback.

4. Add cache:
   - in-memory for local;
   - Postgres/Redis for production.

5. Add analytics:
   - `ai_enrichment_requested`;
   - `ai_enrichment_completed`;
   - `ai_provider_failed`;
   - `full_audit_requested`;
   - `campaign_draft_requested`.

6. Add compliance:
   - AI processing notice;
   - no PII in model prompts;
   - provider-specific data processing policy.

## Unit Economics

Assumptions:

- one SERP analysis: 10 ads, 2 000 input tokens, 600 output tokens if AI is used;
- one Wordstat analysis: 80 keys, 3 000 input tokens, 800 output tokens;
- full report: 8 000 input tokens, 3 000 output tokens;
- local rules cost: zero.

Approximate costs:

| Task | Local rules | GigaChat Lite sync | DeepSeek Chat | OpenAI GPT-5.4 mini |
|---|---:|---:|---:|---:|
| SERP AI enrichment | $0 | ~0.02-0.04 ₽ | ~$0.0012 | ~$0.0042 |
| Wordstat AI enrichment | $0 | ~0.03-0.06 ₽ | ~$0.0017 | ~$0.0059 |
| Full report | $0 | ~0.4-0.8 ₽ | ~$0.0055 | ~$0.0195 |

These are model-token costs only, excluding backend, storage, retries, monitoring and payment overhead.

Free limits:

- anonymous: unlimited local rules, 0 AI;
- lead: 1 cheap AI mini-report;
- registered free: 3-5 cheap enrichments/month;
- paid: full AI audit and monitoring.

## Architecture Comparison

### A. Только YandexGPT

Плюсы:

- РФ-friendly;
- хороший русский;
- близко к Яндекс-экосистеме.

Минусы:

- не самый дешевый;
- vendor lock-in;
- качество стратегического анализа надо тестировать.

Verdict: хороший РФ-safe вариант, но не самый дешевый.

### B. Только GigaChat

Плюсы:

- дешево на Lite;
- сильный русский;
- РФ compliance лучше foreign providers;
- embeddings недорогие.

Минусы:

- structured output beta/нужно валидировать;
- качество full audit может быть ниже Claude/OpenAI.

Verdict: лучший основной cheap provider для РФ MVP.

### C. Только DeepSeek/Qwen/Kimi/GLM

Плюсы:

- очень дешево;
- OpenAI-compatible у многих;
- хорошо для массовых задач.

Минусы:

- compliance риски;
- стабильность/лимиты/доступность;
- русский рекламный контекст нужно тестировать.

Verdict: хороший fallback, не основной РФ MVP.

### D. Гибрид: local rules + дешевая модель + Claude/OpenAI

Плюсы:

- минимальная стоимость;
- хорошее качество на платных/lead сценариях;
- гибкость;
- можно масштабировать.

Минусы:

- сложнее backend;
- нужен provider router;
- нужна аналитика качества.

Verdict: лучший вариант.

### E. Полностью без AI в extension, AI только в SaaS

Плюсы:

- безопасно;
- дешево;
- нет API keys в extension;
- проще compliance.

Минусы:

- меньше wow-эффекта в extension;
- полный value раскрывается после перехода в SaaS.

Verdict: правильная база для MVP. Лучше объединить с local rules.

## Final Recommendation

Для MVP:

- **Extension**: rules only.
- **Backend cheap AI**: GigaChat Lite/Pro.
- **Fallback**: DeepSeek Chat or Qwen, only if compliance permits.
- **Premium audit**: Claude/OpenAI.
- **Embeddings**: не в MVP; позже GigaChat embeddings или self-host.

Для 100 пользователей:

- local rules + GigaChat on demand.

Для 1 000 пользователей:

- local rules + GigaChat/DeepSeek router + cache.

Для 10 000 пользователей:

- local rules + queue + cache + provider router + embeddings + paid full audit.

Не использовать на MVP:

- direct AI calls from extension;
- Claude/OpenAI for every anonymous scan;
- embeddings for every anonymous scan;
- multi-provider complexity before first retention data.

## Sources

- Yandex AI Studio docs and pricing: https://aistudio.yandex.ru/docs/en/ and https://yandex.cloud/ru/docs/ai-studio/pricing
- GigaChat tariffs: https://developers.sber.ru/docs/ru/gigachat/tariffs/legal-tariffs
- OpenAI pricing: https://openai.com/api/pricing/
- Claude pricing docs: https://platform.claude.com/docs/en/about-claude/pricing
- DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing-details-usd
- Alibaba Cloud Model Studio pricing: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Kimi API pricing docs: https://www.kimi.com/help/kimi-api/api-pricing and https://platform.kimi.ai/docs/pricing/chat
