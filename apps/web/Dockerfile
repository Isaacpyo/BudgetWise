# syntax=docker/dockerfile:1
# Static Expo web export served by nginx. Build from the repository root:
#   docker build -f apps/web/Dockerfile .
# EXPO_PUBLIC_* values are inlined at build time; defaults target docker-compose.

FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Optional extra CA for TLS-inspecting proxies: --secret id=npm_ca,src=ca.pem
# Install scripts only copy native iOS/Android libraries, which a web export never needs.
RUN --mount=type=secret,id=npm_ca \
  if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
  npm ci --workspace @budgetwise/web --include-workspace-root=false --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web

ARG EXPO_PUBLIC_API_URL=http://localhost:8787
ARG EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true
ARG EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=localhost
ARG EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-budgetwise
ARG EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key
ARG EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG EXPO_PUBLIC_FIREBASE_APP_ID=
RUN npm run build:web --workspace @budgetwise/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
