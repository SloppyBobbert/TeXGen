FROM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS base

WORKDIR /app

# Share the existing locked dependencies between development and asset builds.
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN chmod +x ./scripts/dev-entrypoint.sh

FROM base AS assets
RUN npm run build

FROM nginx:stable-alpine@sha256:ef8676b33d681f272ba429b27658bdd7e640963279714c96bddf1dc76307f7b6 AS production
COPY --from=assets /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

# Keep the existing development behavior as the default build target.
FROM base AS development
EXPOSE 5173

CMD ["sh", "./scripts/dev-entrypoint.sh"]
