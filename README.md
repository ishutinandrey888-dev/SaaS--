# SaaS — ДОЖИМ-АИ

AI-сервис для аудита и усиления рекламы: Яндекс Директ, кампании,
генерация баннеров, радар конкурентов, токены и реферальная программа.

- **Яндекс Директ / Кампании** — подключение аккаунта, агенты, аудиты,
  рекомендации и история запусков.
- **Генерация изображений** — брифы, бренд-данные, будущие баннеры и
  ассеты для рекламы.
- **Радар конкурентов** — объявления, УТП, офферы, слабые места,
  Wordstat-сигналы и список наблюдения.
- **Биллинг** — тарифы Free / Pro / Agency в токенах, баланс, лимиты,
  Robokassa и докупка пакетов.
- **Реферальная программа** — персональная ссылка и начисление бонусных
  токенов за рекомендации.

## Запуск локально за одну команду

Нужен установленный Docker Desktop / Docker Engine + Compose v2.

```bash
docker compose up --build
```

После того, как всё поднимется:

- Frontend: http://localhost:3000
- Backend API + OpenAPI: http://localhost:8000/docs

Регистрируйтесь через http://localhost:3000/register, подключайте проект,
тестируйте платёжный флоу (stub провайдера сам «подтверждает» платёж),
смотрите метрики по `/admin`. Для демо-админки есть готовый вход:
`admin@dozim.ai` / `password`.

Нужны AI-улучшения? Положите OpenAI-ключ в `.env` (шаблон — `.env.example`),
перезапустите: `docker compose up -d --build backend worker`.

Сбросить БД и начать с нуля:

```bash
docker compose down -v
```

## Стек

- **Backend**: FastAPI + Python 3.12, SQLAlchemy 2.0, Alembic, Celery
- **DB/Auth**: Supabase (Postgres + RLS), JWT (access 15m / refresh 30d)
- **AI**: OpenAI GPT-4o + LangChain
- **Excel**: openpyxl + xlrd
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind, Zustand
- **Payments**: Robokassa

## Разработка

Смотри `backend/.env.example`. Миграции применяются через Alembic.
RLS-политики Supabase вынесены в `docs/rls_policies.sql` и дублируются
миграциями. Новые боевые домены токенов, рефералок, радара конкурентов
и image-briefs добавлены миграцией `0008_tokens_referrals_competitors_images.py`.

Перед деплоем скопируйте `deploy/.env.example` в `deploy/.env`,
`deploy/.env.frontend.example` в `deploy/.env.frontend` и заполните
реальные Supabase, OpenAI, Robokassa, Yandex OAuth и secret-ключи.
