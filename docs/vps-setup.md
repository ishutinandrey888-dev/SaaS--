# VPS Setup (Hybrid: Supabase + self-hosted backend)

Managed by Supabase: Postgres, Auth, backups.
Self-hosted on VPS: FastAPI backend, Celery worker/beat, Redis, Next.js
frontend, nginx with TLS.

Tested on Ubuntu 22.04 / 24.04, 2 vCPU / 4 GB RAM / 40 GB disk.

## 1. Supabase project

1. Create a project at https://supabase.com.
2. Project Settings → Database. Three URLs go into `deploy/.env`:

   | Env var               | Supabase endpoint                 | Why              |
   |-----------------------|-----------------------------------|------------------|
   | `DATABASE_URL_ADMIN`  | **Transaction pooler** (port 6543) | Runtime, BYPASSRLS role. Pooler multiplexes hundreds of async clients over a handful of real connections. |
   | `DATABASE_URL_USER`   | **Transaction pooler** (port 6543) | Runtime, NOBYPASSRLS role (created in §1a). Same reason. |
   | `DATABASE_URL_SYNC`   | **Direct / session mode** (port 5432) | Alembic. Migrations need session-level features (advisory locks, `SET search_path`, etc.) that transaction mode strips. |

   Scheme for async URLs: `postgresql+asyncpg://…?ssl=require`.
   Scheme for the sync URL: `postgresql+psycopg2://…?sslmode=require`.
3. Project Settings → API: copy `service_role` and `anon` keys into
   `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY`.
4. SQL editor → run `docs/rls_policies.sql` (or rely on Alembic).

Why transaction pooler at runtime: direct Postgres connections are
capped (~60 on Free). With two engines × (5 pool + 10 overflow) per
replica **plus Celery workers**, you'd hit that ceiling with a single
container.  The transaction pooler raises the ceiling into the hundreds
because connections are borrowed only for the duration of a single
transaction.  Our `set_config('request.jwt.claim.sub', …, true)` is
transaction-local so it stays compatible.

Raise `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` (env vars) only if you observe
`QueuePool limit … overflow … reached` warnings in logs.

### 1a. Create the restricted `app_user` role (one-time)

Without this role, RLS is a no-op: the default `postgres` role has
`BYPASSRLS`, so `SET LOCAL request.jwt.claim.sub` has no effect.
`docs/db-roles.sql` creates an `app_user` role with `NOBYPASSRLS` and
grants it DML-only rights on `public`.

```bash
# Generate a strong password and stash it in deploy/.env as APP_USER_PASSWORD
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'

# Run the script as the project owner (`postgres`). Locally via psql:
APP_USER_PASSWORD='paste-from-above' \
  psql "$DATABASE_URL_SYNC_NO_DRIVER" -f docs/db-roles.sql
# Or paste the contents into Supabase → SQL editor (replace the
# \set line with a literal password).
```

Verify in psql:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';
-- rolbypassrls must be `f` (false).
```

Put the credentials into `DATABASE_URL_USER` (use the **transaction
pooler** endpoint, port 6543):
`postgresql+asyncpg://app_user:<APP_USER_PASSWORD>@<host>:6543/postgres?ssl=require`

## 2. VPS bootstrap

```bash
# As root on a fresh Ubuntu box
ssh root@your-vps
curl -fsSL https://raw.githubusercontent.com/ishutinandrey888-dev/saas--/main/deploy/scripts/bootstrap-vps.sh | bash

# Create a non-root deploy user and switch
adduser app
usermod -aG docker,sudo app
mkdir -p /home/app/.ssh && cp ~/.ssh/authorized_keys /home/app/.ssh/
chown -R app:app /home/app/.ssh
```

Harden SSH (`/etc/ssh/sshd_config`):

```
PermitRootLogin no
PasswordAuthentication no
```

Then `systemctl restart ssh` and test login as `app` before closing
the root session.

## 3. Clone + configure

```bash
sudo mkdir -p /opt/saas-direct && sudo chown app:app /opt/saas-direct
git clone https://github.com/ishutinandrey888-dev/saas--.git /opt/saas-direct
cd /opt/saas-direct

cp deploy/.env.example          deploy/.env
cp deploy/.env.frontend.example deploy/.env.frontend
# Fill in real values (Supabase URL/keys, OpenAI, FERNET_KEY, JWT_SECRET, …).
# Generate local secrets:
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

## 4. DNS

Point A-record `your-domain.tld` (and `www`) at the VPS IP, wait for
propagation (`dig +short your-domain.tld`).

## 5. Issue TLS cert

```bash
# 1. Render HTTP-only nginx config and start stack
make render-nginx-bootstrap DOMAIN=your-domain.tld
make up

# 2. Get cert
make certbot-issue DOMAIN=your-domain.tld EMAIL=you@your-domain.tld

# 3. Swap in full HTTPS config
make render-nginx-app DOMAIN=your-domain.tld
docker compose -f deploy/docker-compose.yml exec nginx nginx -s reload
```

## 6. Migrations

```bash
make migrate
```

## 7. systemd (auto-start + cert renewal)

```bash
sudo cp deploy/systemd/saas-direct.service       /etc/systemd/system/
sudo cp deploy/systemd/certbot-renew.service     /etc/systemd/system/
sudo cp deploy/systemd/certbot-renew.timer       /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now saas-direct.service
sudo systemctl enable --now certbot-renew.timer
```

## 8. Updates

```bash
# From your laptop: push to main
git push origin main

# On the VPS
cd /opt/saas-direct && make deploy
```

## 9. Backups

Supabase runs daily Postgres backups automatically (7d retention on the
free tier, longer on paid). On VPS you only need to back up:

- `deploy/.env` (keep offline, do **not** commit)
- Docker volume `saas-direct_uploads` — user-uploaded Excel files

```bash
# Nightly dump of uploads volume (add to crontab of user 'app')
0 4 * * * docker run --rm -v saas-direct_uploads:/data -v /var/backups:/out alpine \
          tar czf /out/uploads-$(date +\%F).tgz -C /data . && \
          find /var/backups -name 'uploads-*.tgz' -mtime +14 -delete
```

## 10. Observability (minimum)

- `make logs`
- `docker compose -f deploy/docker-compose.yml ps`
- `journalctl -u saas-direct.service -f`

Heavier (optional): add `grafana-agent` or `loki+grafana` later.

## 11. Useful Make targets

| Command                         | Action                                  |
|---------------------------------|-----------------------------------------|
| `make up`                       | Start stack (no frontend profile)       |
| `make up-full`                  | Start stack + frontend                  |
| `make down`                     | Stop stack                              |
| `make logs`                     | Tail all service logs                   |
| `make migrate`                  | Apply Alembic migrations                |
| `make deploy`                   | Git pull + rebuild + migrate + reload   |
| `make certbot-issue DOMAIN=…`   | Issue Let's Encrypt cert                |
| `make certbot-renew`            | Renew cert (runs daily via timer)       |

## Why two database engines

The backend opens two async SQLAlchemy engines against the same
Postgres:

| Engine         | Role (NOBYPASSRLS?) | Used by                                  |
|----------------|---------------------|------------------------------------------|
| `engine_admin` | `postgres` (no)     | Auth (register/login), brute-force guard, audit writes, migrations, admin jobs |
| `engine_user`  | `app_user` (yes)    | Every request that reads/writes a user's own rows (campaigns, keywords, ads, reports, …) |

Each `engine_user` session runs
`SELECT set_config('request.jwt.claim.sub', <user-id>, true)`
at the start of its transaction, and the RLS policies compare that
setting against each row's `user_id`. Because `app_user` does **not**
have `BYPASSRLS`, Postgres actually enforces the policy — a bug that
forgets a `WHERE user_id = …` filter still cannot leak data across
tenants.

Auth endpoints use `engine_admin` on purpose: registration creates a
row that doesn't yet have a JWT, and brute-force/audit rows aren't
scoped to a single user.
