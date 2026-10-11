# Fiche Infirmerie Numérique — image Docker (fusion ndm-sante)
# Build : Vite 8 (frontend React) + esbuild (backend Express -> dist/server.cjs)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
# Cahier des charges RGPD (modèle officiel + version modifiable)
COPY CAHIER_DES_CHARGES_RGPD.md CAHIER_DES_CHARGES_RGPD_DEFAULT.md ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint-ndm.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-ndm.sh && mkdir -p /app/data/archives
EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3001/api/classes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/docker-entrypoint-ndm.sh"]
CMD ["node", "dist/server.cjs"]
