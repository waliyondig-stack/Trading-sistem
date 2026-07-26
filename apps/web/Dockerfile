# FlowNiaga Web — build dari root repo:
#   docker build -f apps/web/Dockerfile -t flowniaga-web .
# NEXT_PUBLIC_API_URL di-bake saat build; default '/api/backend' berarti
# browser memanggil API lewat proxy same-origin (lihat next.config.ts).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api/backend
ARG NEXT_PUBLIC_APP_NAME=FlowNiaga
# URL API tujuan proxy same-origin (WAJIB diisi saat build, mis.
# https://flowniaga-api.onrender.com atau http://api:3001 di compose).
ARG API_PROXY_TARGET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV API_PROXY_TARGET=$API_PROXY_TARGET

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @flowniaga/web build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Next standalone output: server mandiri tanpa node_modules penuh.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
