# syntax=docker/dockerfile:1.7

# --- Deps ------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Use ci when a lockfile exists; fall back to install for first-time setups.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# --- Builder ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `public/` is optional; create it if the project doesn't ship one so
# the later COPY --from=builder /app/public never misses.
RUN mkdir -p ./public
# NEXT_PUBLIC_* vars are baked in at build time.  The value below is
# what the browser calls; /api requests from the host land on the
# backend via the compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# --- Runtime: minimal standalone server ------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S app && adduser -S app -G app

# Next 14 standalone output bundles the server + node_modules it needs.
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000
CMD ["node", "server.js"]
