# Supabase — инструкция по развёртыванию ДОЖИМ-АЙ

## 1. Создать проект Supabase

1. Зайти на [supabase.com](https://supabase.com) → New Project
2. Запомнить **Project URL** и **anon key** (Settings → API)

---

## 2. Применить схему БД

В Supabase SQL Editor выполнить файлы по порядку:

```sql
-- 1. Таблицы, триггеры, функции
\i supabase/schema.sql

-- 2. Row Level Security (политики доступа)
\i supabase/rls.sql
```

Или через CLI:
```bash
supabase db push  # если используете суpabase CLI + migrations
```

---

## 3. Настроить переменные окружения

Скопировать `.env.local` и заполнить реальными значениями:

```bash
cp .env.local.example .env.local   # если добавите пример в репо
```

Для standalone-прототипа можно добавить в `<head>` перед клиентским скриптом:

```html
<script>
  window.__SUPABASE_URL__      = 'https://XXXXXXXX.supabase.co';
  window.__SUPABASE_ANON_KEY__ = 'eyJhbG...';
</script>
```

---

## 4. Развернуть Edge Functions

```bash
# Установить Supabase CLI
npm install -g supabase

# Войти
supabase login

# Привязать к проекту
supabase link --project-ref XXXXXXXXXXXXXXXX

# Задеплоить все функции
supabase functions deploy invite-employee
supabase functions deploy accept-invite
supabase functions deploy track-utm

# Установить секреты для функций
supabase secrets set SITE_URL=https://app.dozim.ai
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

---

## 5. Настроить первого владельца (owner)

После регистрации первого пользователя через UI — вставить его в `employees` вручную:

```sql
-- Узнать id пользователя
select id, email from auth.users order by created_at limit 5;

-- Добавить как owner
insert into public.employees (name, email, position, role, status, user_id)
values ('Иван Петров', 'admin@dozim.ai', 'CEO / Основатель', 'owner', 'active',
        '<uuid из auth.users>');
```

После этого пользователь получит полный доступ к админ-панели (маршрут `#/admin`).

---

## 6. Supabase Auth — настройки email

В Supabase → Authentication → Settings:
- **Site URL**: `https://app.dozim.ai`
- **Redirect URLs**: добавить `https://app.dozim.ai/accept-invite`
- **Email Templates → Invite**: можно кастомизировать текст письма

---

## 7. Проверить работу

| Действие | Ожидаемый результат |
|---|---|
| Зарегистрироваться | Строка в `auth.users` + `profiles` |
| Войти как owner | `#/admin` — полный доступ |
| Пригласить сотрудника | Письмо + строка в `employees` (status=invited) |
| Перейти по ссылке из письма | status → active, user_id заполнен |
| Создать UTM-метку | Строка в `utm_links` |
| Создать задачу | Строка в `tasks` |

---

## Структура файлов

```
supabase/
  schema.sql              — таблицы, триггер, has_permission()
  rls.sql                 — Row Level Security политики
  functions/
    invite-employee/      — отправка приглашения + запись в employees
    accept-invite/        — активация по токену
    track-utm/            — инкремент счётчика кликов/конверсий
.env.local                — переменные окружения (не коммитить!)
```
