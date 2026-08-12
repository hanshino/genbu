FROM node:22-alpine AS base

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
RUN npm run build && rm -f .next/standalone/tthol.sqlite

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
# Next standalone tracing may include the build input database; the builder
# removes it so production must provide the read-only runtime mount.

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
