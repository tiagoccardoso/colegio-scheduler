# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps (works even if package-lock is out of sync)
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# Dev runtime (hot reload)
FROM deps AS dev
EXPOSE 3000
CMD ["npm","run","dev","--","-H","0.0.0.0","-p","3000"]

# Build
FROM deps AS builder
COPY . .
RUN npm run build

# Prod runtime
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# next.config.* is optional
COPY --from=builder /app/next.config.* ./ 2>/dev/null || true
EXPOSE 3000
CMD ["npm","run","start","--","-H","0.0.0.0","-p","3000"]
