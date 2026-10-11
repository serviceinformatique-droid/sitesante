# Portail Santé NDM (hub iframe) — image Docker (fusion ndm-sante)
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3020/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
