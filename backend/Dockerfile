# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4001
RUN apt-get update -qq && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data /app/uploads/products
EXPOSE 4001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
