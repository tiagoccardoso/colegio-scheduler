# syntax=docker/dockerfile:1.6
# ClassFlow Site (Next.js) - production-ready container
# Build:   docker build -t classflow-site .
# Run:     docker run --rm -p 3000:3000 --env-file .env.local classflow-site

FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN   if [ -f package-lock.json ]; then npm ci;   elif [ -f yarn.lock ]; then yarn --frozen-lockfile;   elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile;   else npm i; fi

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# If you later add Next Image Optimization with sharp, you may need libc6-compat
RUN apk add --no-cache libc6-compat

# Copy the built output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Next.js production server
CMD ["npm", "run", "start"]
