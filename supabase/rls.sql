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
