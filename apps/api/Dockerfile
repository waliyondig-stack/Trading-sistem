# FlowNiaga API — build dari root repo:
#   docker build -f apps/api/Dockerfile -t flowniaga-api .
FROM node:22-alpine
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @flowniaga/domain --filter @flowniaga/config build \
  && pnpm --filter @flowniaga/api build \
  && pnpm prune --prod || true

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
# Migration dijalankan saat start (aman & idempotent: prisma migrate deploy).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
