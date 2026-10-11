# Portail Voyages Scolaires (orgavoyageV2) — image Docker (fusion ndm-sante)
# Build : Vite 6 (frontend React) + esbuild (backend Express -> dist/server.cjs)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PIECES_DIR=/app/pieces-jointes
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data /app/backups /app/pieces-jointes
EXPOSE 3000
VOLUME ["/app/data", "/app/backups", "/app/pieces-jointes"]
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.cjs"]
