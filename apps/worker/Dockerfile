# FlowNiaga Worker — build dari root repo:
#   docker build -f apps/worker/Dockerfile -t flowniaga-worker .
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @flowniaga/worker build

ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
