# Radar Competitor Analysis V2

## 1. Цель

Усилить извлечение и анализ объявлений Яндекс Директ в расширении «Радар конкурентов», чтобы карточка конкурента показывала не просто текст объявления, а рекламную стратегию, оффер, CTA, быстрые ссылки, слабые места и гипотезу для собственной рекламы.

## 2. Проблемы текущего парсинга

- Заголовок часто подменялся breadcrumb/display URL.
- Быстрые ссылки сохранялись как обычные короткие тексты и не участвовали в анализе.
- CTA не выделялся отдельно.
- Оффер определялся только по простому списку тегов.
- Не было классификации стратегии конкурента.
- Не было модели для будущего enrichment посадочной страницы.

## 3. Новая архитектура извлечения

### 3.1 Ad Boundary Detection

Основной вход — метка `Промо`:

- `#search-result span.AdvLabel-Text`
- `span.AdvLabel-Text`
- `.AdvLabel-Text`
- текстовые узлы с `Промо`

После этого парсер поднимается к ближайшему контейнеру объявления:

- `#search-result > li`
- `li`
- `div.Organic-ContentWrapper`
- `div.TextContainer`
- `[class*='Organic']`

Жёсткий селектор конкретного `nth-child` можно использовать только как debug/fallback, потому что структура выдачи Яндекса меняется.

### 3.2 Raw Extraction

Для каждого объявления собирается:

- `realHeadline`
- `displayUrl`
- `domain`
- `description`
- `sitelinks[]`
- `position`
- `query`
- `isPromo` / `adLabel`
- `raw/source` поля: `source`, `sourceType`, `capturedAt`

### 3.3 Parser Layer

Добавлены группы сигналов:

- `offerSignals[]`
- `priceSignals[]`
- `urgencySignals[]`
- `guaranteeSignals[]`
- `leadMagnetSignals[]`
- `ctaSignals[]`
- `geoSignals[]`
- `trustSignals[]`

### 3.4 Intelligence Layer

Поверх сигналов формируются:

- `primaryOffer`
- `usp`
- `cta`
- `strategy`
- `triggers[]`
- `strengths[]`
- `weaknesses[]`
- `missingTriggers[]`
- `differentiationPoint`
- `hypothesis`
- `insight`

## 4. Стратегии конкурентов

Классификация:

- `price-led` — цена, расчет, смета, конкретный диапазон.
- `trust-led` — гарантия, договор, без риска.
- `urgency-led` — сроки, срочность, ограничение.
- `lead-magnet-led` — бесплатный замер, квиз, калькулятор, консультация.
- `assortment-led` — каталог, широкий выбор, много объектов.
- `geo-led` — район, рядом, выезд, город.
- `expertise-led` — опыт, сертификаты, статус, премии.
- `mixed` — смешанная или слабо выраженная стратегия.

## 5. Быстрые ссылки

Быстрые ссылки теперь сохраняются как объекты:

```json
{
  "title": "Цены на ремонт",
  "url": "https://example.ru/prices",
  "domain": "example.ru",
  "signals": ["цена"],
  "role": "price"
}
```

Роли:

- `price`
- `lead_magnet`
- `trust`
- `contact`
- `assortment`
- `navigation`

## 6. Новая карточка конкурента

Минимальный состав карточки:

- домен;
- позиция;
- настоящий заголовок;
- описание;
- основной оффер;
- CTA;
- стратегия;
- сильные стороны;
- слабые места;
- быстрые ссылки;
- триггеры;
- точка отстройки;
- гипотеза для Директа.

## 7. Enrichment Layer

Следующий backend/SaaS-слой должен анализировать посадочную страницу конкурента:

- `H1`
- `Hero offer`
- `CTA`
- `Form presence`
- `Phone presence`
- `Pricing presence`
- `Quiz presence`
- `Messenger presence`
- `Trust blocks`

Важно: этот слой лучше выполнять на backend с rate limit, кешем и нормальными ошибками. Расширение не должно массово обходить сайты конкурентов напрямую.

## 8. Что внедрено в код

Файл: `extension/src/content/yandex-search.js`

- Заголовок теперь извлекается как `realHeadline`.
- Display URL вынесен отдельно в `displayUrl`.
- Быстрые ссылки анализируются и сохраняются с ролями.
- Добавлены группы сигналов.
- Добавлены CTA, стратегия, primary offer, USP, strengths, weaknesses, missing triggers, differentiation point.
- Summary больше не ограничивается фразой «Оффер выражен слабо».

Файлы отображения:

- `extension/src/popup/popup.js`
- `extension/src/sidepanel/sidepanel.js`

Теперь показывают стратегию, CTA, оффер, слабые места и быстрые ссылки, если они есть.

## 9. Что осталось сделать

P0:

- Проверить на 10–20 коммерческих запросах в Яндексе.
- Собрать реальные DOM-примеры для разных вертикалей.
- Добавить защиту от дублей по `domain + realHeadline + query`.
- Добавить визуальный score силы оффера.

P1:

- Backend enrichment посадочных страниц.
- Сравнение конкурентов по офферам.
- История изменений оффера по домену.
- Экспорт отчёта в SaaS.

P2:

- Мониторинг SERP по расписанию.
- Уведомления при появлении нового конкурента.
- Интеграция с Яндекс Директ.
