# SaaS — AI-конструктор рекламы + AI-аналитик Яндекс Директ

MVP без Yandex Direct API: импорт/экспорт через Excel.

- **START** — агент-конструктор: бриф → анализ сайта/конкурентов →
  семантика и объявления → экспорт XLSX Мастера кампаний.
- **Analyst** — AI-аналитик: загрузка XLS-отчёта Директа → детекция
  отклонений → предложения действий → экспорт изменений в XLSX.

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
