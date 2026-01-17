FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --no-audit --no-fund


FROM node:20-alpine AS dev

WORKDIR /app

RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app

COPY --from=deps /app/node_modules /app/node_modules

COPY --chown=app:app . .

USER root

COPY docker/entrypoint-dev.sh /usr/local/bin/entrypoint-dev.sh

RUN chmod +x /usr/local/bin/entrypoint-dev.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint-dev.sh"]


FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

COPY . .

RUN npm run build


FROM nginx:1.27-alpine AS prod

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]


FROM dev AS analyze

EXPOSE 8888

CMD ["npm", "run", "analyze"]