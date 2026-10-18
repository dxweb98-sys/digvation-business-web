FROM node:24-bookworm AS build-base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
ARG BUILD_REVISION=local
ENV VITE_BUILD_REVISION=${BUILD_REVISION}

FROM build-base AS backoffice-build
RUN pnpm build:backoffice && rm -f apps/backoffice/dist/runtime-config.json

FROM build-base AS operational-build
RUN pnpm build:operational && rm -f apps/operational/dist/runtime-config.json

FROM nginxinc/nginx-unprivileged:1.28-alpine AS web-runtime
COPY deployment/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/healthz || exit 1

FROM build-base AS member-portal-build
RUN pnpm build:member && rm -f apps/member-portal/dist/runtime-config.json

FROM web-runtime AS backoffice
ARG BUILD_REVISION=local
LABEL org.opencontainers.image.title="Digvation Business Backoffice" \
  org.opencontainers.image.revision="${BUILD_REVISION}"
COPY --from=backoffice-build /app/apps/backoffice/dist/ /usr/share/nginx/html/

FROM web-runtime AS operational
ARG BUILD_REVISION=local
LABEL org.opencontainers.image.title="Digvation Business Operational" \
  org.opencontainers.image.revision="${BUILD_REVISION}"
COPY --from=operational-build /app/apps/operational/dist/ /usr/share/nginx/html/

FROM nginxinc/nginx-unprivileged:1.28-alpine AS member-portal
ARG BUILD_REVISION=local
COPY deployment/nginx/member-portal.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/healthz || exit 1
LABEL org.opencontainers.image.title="Digvation Business Member Portal" \
  org.opencontainers.image.revision="${BUILD_REVISION}"
COPY --from=member-portal-build /app/apps/member-portal/dist/ /usr/share/nginx/html/member/
