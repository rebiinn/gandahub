# syntax=docker/dockerfile:1
# Railway: set service Root Directory to `frontend`. Optional build var: VITE_API_URL
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "exec ./node_modules/.bin/serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
