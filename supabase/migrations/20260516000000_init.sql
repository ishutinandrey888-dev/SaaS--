-- ══════════════════════════════════════════════════════════════
-- ДОЖИМ-АЙ  —  Supabase schema
-- Run once in the Supabase SQL Editor (or via supabase db push)
-- ══════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────
-- One row per auth.users entry; synced via trigger
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  plan        text not null default 'free',    -- free | pro | enterprise
  plan_expires_at timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── employees ─────────────────────────────────────────────────
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text not null unique,
  position    text,
  role        text not null default 'viewer',
  status      text not null default 'invited',  -- invited | active | blocked
  user_id     uuid references auth.users(id) on delete set null,
  invite_token text unique,
  joined_at   date not null default current_date,
  last_active_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── role_permissions ──────────────────────────────────────────
create table if not exists public.role_permissions (
  role        text not null,
  permission  text not null,
  primary key (role, permission)
);

-- Seed role_permissions from ROLE_PERMS in index (7).html
insert into public.role_permissions (role, permission) values
  ('owner','users.view'),('owner','users.edit'),('owner','broadcast.send'),
  ('owner','utm.manage'),('owner','sources.view'),('owner','finance.view'),
  ('owner','finance.edit'),('owner','employees.manage'),('owner','tasks.assign'),
  ('owner','settings.edit'),
  ('admin','users.view'),('admin','users.edit'),('admin','broadcast.send'),
  ('admin','utm.manage'),('admin','sources.view'),('admin','finance.view'),
  ('admin','finance.edit'),('admin','tasks.assign'),('admin','settings.edit'),
  ('manager','users.view'),('manager','users.edit'),('manager','broadcast.send'),
  ('manager','sources.view'),('manager','tasks.assign'),
  ('marketer','users.view'),('marketer','broadcast.send'),('marketer','utm.manage'),
  ('marketer','sources.view'),
  ('support','users.view'),('support','broadcast.send'),
  ('finance','users.view'),('finance','finance.view'),('finance','finance.edit'),
  ('viewer','users.view'),('viewer','sources.view'),('viewer','finance.view')
on conflict do nothing;

-- ── utm_links ─────────────────────────────────────────────────
create table if not exists public.utm_links (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  source      text not null,
  medium      text not null,
  campaign    text not null,
  content     text,
  term        text,
  clicks      int not null default 0,
  conversions int not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── tasks ─────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  assignee_id uuid references public.employees(id) on delete set null,
  status      text not null default 'todo',      -- todo | in_progress | done
  priority    text not null default 'mid',       -- low | mid | high
  deadline    date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── broadcast_logs ────────────────────────────────────────────
create table if not exists public.broadcast_logs (
  id          uuid primary key default gen_random_uuid(),
  template    text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_ids  uuid[],          -- null = all users
  sent_by     uuid references auth.users(id) on delete set null,
  sent_at     timestamptz not null default now(),
  status      text not null default 'sent'
);

-- ── Helper: has_permission ────────────────────────────────────
create or replace function public.has_permission(p_user_id uuid, p_perm text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role = e.role
    where e.user_id = p_user_id
      and e.status = 'active'
      and rp.permission = p_perm
  );
$$;
-- ══════════════════════════════════════════════════════════════
-- ДОЖИМ-АЙ  —  Row Level Security
-- Run after schema.sql
-- ══════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Users see only their own profile
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- employees.manage holders see all profiles
create policy "profiles: managers read all" on public.profiles
  for select using (public.has_permission(auth.uid(), 'users.view'));

-- ── employees ─────────────────────────────────────────────────
alter table public.employees enable row level security;

create policy "employees: view" on public.employees
  for select using (public.has_permission(auth.uid(), 'users.view'));

create policy "employees: manage" on public.employees
  for all using (public.has_permission(auth.uid(), 'employees.manage'));

-- ── role_permissions ──────────────────────────────────────────
alter table public.role_permissions enable row level security;

-- Read-only for everyone authenticated (needed for the role picker UI)
create policy "role_permissions: authenticated read" on public.role_permissions
  for select using (auth.uid() is not null);

-- Only owners can modify role permissions
create policy "role_permissions: owners write" on public.role_permissions
  for all using (public.has_permission(auth.uid(), 'settings.edit'));

-- ── utm_links ─────────────────────────────────────────────────
alter table public.utm_links enable row level security;

create policy "utm_links: view" on public.utm_links
  for select using (public.has_permission(auth.uid(), 'sources.view'));

create policy "utm_links: manage" on public.utm_links
  for all using (public.has_permission(auth.uid(), 'utm.manage'));

-- ── tasks ─────────────────────────────────────────────────────
alter table public.tasks enable row level security;

create policy "tasks: view" on public.tasks
  for select using (public.has_permission(auth.uid(), 'users.view'));

create policy "tasks: assign" on public.tasks
  for all using (public.has_permission(auth.uid(), 'tasks.assign'));

-- ── broadcast_logs ────────────────────────────────────────────
alter table public.broadcast_logs enable row level security;

create policy "broadcast_logs: view" on public.broadcast_logs
  for select using (public.has_permission(auth.uid(), 'users.view'));

create policy "broadcast_logs: send" on public.broadcast_logs
  for insert with check (public.has_permission(auth.uid(), 'broadcast.send'));
