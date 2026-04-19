.PHONY: help dev up down logs ps build migrate revision shell bash \
        render-nginx-bootstrap render-nginx-app \
        certbot-issue certbot-renew deploy test lint fmt

COMPOSE := docker compose -f deploy/docker-compose.yml
DOMAIN  ?= your-domain.tld
EMAIL   ?= admin@$(DOMAIN)

help:                   ## Show this help
	@awk 'BEGIN{FS=":.*?## "} /^[a-zA-Z_-]+:.*?## /{printf "  \033[36m%-26s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

# --- Local dev -------------------------------------------------------
dev:                    ## Run backend locally (uvicorn, hot reload)
	cd backend && uvicorn app.main:app --reload --port 8000

test:                   ## pytest
	cd backend && pytest -q

lint:                   ## ruff check
	cd backend && ruff check .

fmt:                    ## ruff format
	cd backend && ruff format .

# --- Compose ---------------------------------------------------------
build:                  ## Build backend image
	$(COMPOSE) build backend

up:                     ## Start stack (without frontend profile)
	$(COMPOSE) up -d redis backend worker beat nginx

up-full:                ## Start stack including frontend
	$(COMPOSE) --profile full up -d

down:                   ## Stop stack
	$(COMPOSE) down

ps:                     ## Show service status
	$(COMPOSE) ps

logs:                   ## Tail logs
	$(COMPOSE) logs -f --tail=200

bash:                   ## Shell into backend container
	$(COMPOSE) exec backend sh

# --- Migrations ------------------------------------------------------
migrate:                ## Apply Alembic migrations
	$(COMPOSE) run --rm backend alembic upgrade head

revision:               ## Autogenerate a new migration: make revision M="msg"
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(M)"

# --- TLS / nginx -----------------------------------------------------
render-nginx-bootstrap: ## Render HTTP-only nginx conf (pre-cert)
	DOMAIN=$(DOMAIN) MODE=bootstrap deploy/scripts/render-nginx.sh

render-nginx-app:       ## Render HTTPS nginx conf (post-cert)
	DOMAIN=$(DOMAIN) MODE=app deploy/scripts/render-nginx.sh

certbot-issue:          ## Obtain initial Let's Encrypt cert
	DOMAIN=$(DOMAIN) EMAIL=$(EMAIL) deploy/scripts/certbot-issue.sh

certbot-renew:          ## Renew cert (idempotent)
	deploy/scripts/certbot-renew.sh

# --- Deploy ----------------------------------------------------------
deploy:                 ## Pull, rebuild, migrate, roll services
	deploy/scripts/deploy.sh
