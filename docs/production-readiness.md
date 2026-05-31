# Production Readiness

Короткий чеклист перед первым боевым деплоем ДОЖИМ-АИ.

## Обязательные секреты

Заполнить на VPS:

- `deploy/.env` из `deploy/.env.example`
- `deploy/.env.frontend` из `deploy/.env.frontend.example`

Критичные значения:

- `DATABASE_URL_ADMIN`, `DATABASE_URL_USER`, `DATABASE_URL_SYNC`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
- `FERNET_KEY`, `JWT_SECRET`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `AI_MONTHLY_BUDGET_MINOR`, `AI_BUDGET_ALERT_THRESHOLD_PCT`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OPS_CHAT_ID`
- `ADMIN_EMAILS` — первый email считается руководителем для зарплат
- `CODE_AUDIT_SCHEDULE_DAYS`
- `PAYMENT_RETURN_URL`
- `ROBOKASSA_MERCHANT_LOGIN`, `ROBOKASSA_PASSWORD1`, `ROBOKASSA_PASSWORD2`
- `YANDEX_DIRECT_CLIENT_ID`, `YANDEX_DIRECT_CLIENT_SECRET`,
  `YANDEX_DIRECT_OAUTH_REDIRECT_URL`
- `CORS_ORIGINS`, `PUBLIC_DOMAIN`
- `NEXT_PUBLIC_API_URL`

## База данных

1. Создать restricted role `app_user` по `docs/db-roles.sql`.
2. Проверить, что `app_user.rolbypassrls = false`.
3. Применить Alembic:

```bash
docker compose -f deploy/docker-compose.yml run --rm backend alembic upgrade head
```

Миграция `0008_tokens_referrals_competitors_images.py` добавляет:

- токенный учёт и бонусные транзакции;
- реферальные коды и рекомендации;
- отчёты и наблюдение радара конкурентов;
- брифы генерации изображений;
- RLS-политики для новых пользовательских таблиц.

Миграция `0009_admin_ops_backend.py` добавляет боевые сущности админки:

- CRM-сегменты и лиды;
- отзывы, баги и оценки пользователей;
- продуктовые агентные проверки;
- дневной учет AI-токенов и AI-бюджета;
- правила и ведомости зарплат;
- стартовые шаблоны CRM, агентных проверок и ролей зарплат.

## Биллинг и тарифы

Боевые тарифы сейчас:

- Free: 500 токенов, 0 ₽, ориентировочная себестоимость до 90 ₽.
- Pro: 5 000 токенов, 5 990 ₽/мес, ориентировочная себестоимость до 850 ₽.
- Agency: 15 000 токенов, 19 900 ₽/мес, ориентировочная себестоимость до 3 200 ₽.

Баланс токенов отдаёт `GET /billing/tokens`. На 80% расхода UI должен
показывать предупреждающий pop-up, при полном исчерпании — pop-up с
докупкой токенов.

## Интеграции

Реальная готовность требует:

- Robokassa: боевой магазин, Result URL на backend webhook, Success URL
  на `PAYMENT_RETURN_URL`, заполненный allowlist IP при необходимости.
- Yandex Direct OAuth: приложение в id.yandex.ru, redirect URL ровно как
  в `YANDEX_DIRECT_OAUTH_REDIRECT_URL`.
- OpenAI: production key и лимиты расходов на стороне аккаунта.
- Wordstat / конкурентные данные: подключить реальный источник вместо
  текущего детерминированного backend-черновика.
- Генерация изображений: подключить провайдера генерации и хранение
  ассетов после текущего слоя image-briefs.

## Админка и операционный контур

Backend endpoints:

- `GET /admin/crm` — CRM-сегменты, лиды и шаблоны.
- `PATCH /admin/crm/segments/{slug}` — редактирование шаблона/каналов.
- `POST /admin/crm/segments/{slug}/broadcast` — постановка уведомлений
  в очередь `notifications`.
- `POST /feedback` — пользователь отправляет отзыв/баг/оценку.
- `GET /admin/feedback` — админка читает обратную связь.
- `GET /admin/agent-ops` — статусы агентов, аудит кода, токены и бюджет.
- `GET /admin/payroll` — ведомость зарплат, доступ только руководителю
  (первый email из `ADMIN_EMAILS`).

Celery Beat теперь планирует:

- `ops.daily_digest` — ежедневный Telegram-дайджест. Если все штатно,
  приходит короткое сообщение “все работает штатно”; если есть новые
  отзывы, ошибки агентов или превышение AI-бюджета — алерт с деталями.
- `ops.code_audit_tick` — поддерживает расписание аудита кода раз в
  `CODE_AUDIT_SCHEDULE_DAYS`. Исполнитель аудита может быть внутренним
  агентом или внешним code-audit инструментом.

## Smoke-тест после деплоя

```bash
curl -fsS https://your-domain.tld/api/health
curl -fsS https://your-domain.tld/api/billing/plans
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 backend
```

Проверить вручную:

- регистрация / логин;
- `/dashboard`, `/admin`, лендинг;
- создание проекта;
- старт Yandex OAuth;
- получение `/billing/tokens`;
- открытие тарифного окна и создание платежа;
- вкладки “Генерация изображений”, “Радар конкурентов”,
  “Реферальная программа”.
- `/admin` → CRM, “Отзывы и баги”, “Агент продукта”, “Сотрудники →
  Зарплаты”;
- отправка тестового отзыва через `POST /feedback`;
- ежедневный Telegram-дайджест в логах worker/beat, если Telegram еще
  не настроен, или в Telegram-чате, если настроен.
