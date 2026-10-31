# Build context is the repo root (see docker-compose.yml), so the app's deployments file can be copied in:
# one source of truth for addresses and start blocks.
FROM node:22-slim AS base
WORKDIR /app

COPY indexer/package.json indexer/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY indexer/ ./
COPY tawf-finance/src/web3/tokenization.deployments.json ./deployments.json
ENV DEPLOYMENTS_FILE=/app/deployments.json
ENV NODE_ENV=production

RUN npx ponder codegen && npx tsc --noEmit

RUN chown -R node:node /app
USER node
EXPOSE 42069
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:42069/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# DATABASE_SCHEMA names this deploy's tables, DATABASE_VIEWS_SCHEMA is the stable name the views point at.
CMD ["sh", "-c", "npx ponder start --schema \"$DATABASE_SCHEMA\" --views-schema \"$DATABASE_VIEWS_SCHEMA\""]
