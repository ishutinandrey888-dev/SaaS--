# SaaS — AI-конструктор рекламы + AI-аналитик Яндекс Директ

MVP без Yandex Direct API: импорт/экспорт через Excel.

- **START** — агент-конструктор: бриф → анализ сайта/конкурентов →
  семантика и объявления → экспорт XLSX Мастера кампаний.
- **Analyst** — AI-аналитик: загрузка XLS-отчёта Директа → детекция
  отклонений → предложения действий → экспорт изменений в XLSX.

## Запуск локально за одну команду

Нужен установленный Docker Desktop / Docker Engine + Compose v2.

```bash
docker compose up --build
```

После того, как всё поднимется:

- Frontend: http://localhost:3000
- Backend API + OpenAPI: http://localhost:8000/docs

Регистрируйтесь через http://localhost:3000/register, загружайте Excel,
тестируйте платёжный флоу (стаб провайдера сам «подтверждает» платёж),
смотрите метрики по `/admin` (включите в `.env`: `ADMIN_EMAILS=<ваш email>`).

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
- **Payments**: ЮKassa

## Разработка

Смотри `backend/.env.example`. Миграции применяются через Alembic;
RLS-политики Supabase вынесены в `docs/rls_policies.sql` и дублируются
миграцией `0002_rls_policies.py`.
