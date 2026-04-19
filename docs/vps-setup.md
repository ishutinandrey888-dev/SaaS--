# VPS Setup (Hybrid: Supabase + self-hosted backend)

Managed by Supabase: Postgres, Auth, backups.
Self-hosted on VPS: FastAPI backend, Celery worker/beat, Redis, Next.js
frontend, nginx with TLS.

Tested on Ubuntu 22.04 / 24.04, 2 vCPU / 4 GB RAM / 40 GB disk.

## 1. Supabase project

1. Create a project at https://supabase.com.
2. Project Settings → Database: copy the "Session mode" connection
   string. Two URLs are needed in `deploy/.env`:
   - `DATABASE_URL`      — use `postgresql+asyncpg://…?ssl=require`
   - `DATABASE_URL_SYNC` — use `postgresql+psycopg2://…?sslmode=require`
3. Project Settings → API: copy `service_role` and `anon` keys into
   `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY`.
4. SQL editor → run `docs/rls_policies.sql` (or rely on Alembic).

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

## Why RLS still stays on

Even though backend uses `SUPABASE_SERVICE_KEY` (which bypasses RLS),
we keep RLS enabled so that if anything **ever** connects using the
`anon` key (say, a future admin tool using Supabase's client libs),
it can't read other users' rows. Belt-and-suspenders, zero cost.
