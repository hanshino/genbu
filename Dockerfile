FROM node:20-alpine AS base

# -- deps --
FROM base AS deps
WORKDIR /app
# better-sqlite3 may need to compile native bindings if no prebuilt binary matches
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# -- builder --
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -- runner --
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next standalone server output includes only the minimal files needed
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/tthol.sqlite ./tthol.sqlite

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
