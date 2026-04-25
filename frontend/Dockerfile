FROM node:22-alpine AS build

ARG API_URL

WORKDIR /app

RUN apk add --no-cache ca-certificates \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

ENV API_URL=${API_URL}

RUN npm run build

FROM node:22-alpine AS runtime

ARG FRONTEND_APP_UID=10002
ARG FRONTEND_APP_GID=10002

RUN apk add --no-cache ca-certificates dumb-init \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN addgroup -g "${FRONTEND_APP_GID}" brimble \
  && adduser -D -H -u "${FRONTEND_APP_UID}" -G brimble brimble \
  && chown -R brimble:brimble /app

USER brimble

ENV NODE_ENV=production

EXPOSE 5173

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
