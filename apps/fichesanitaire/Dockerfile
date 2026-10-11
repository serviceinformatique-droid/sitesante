# Portail Fiche Sanitaire de Liaison — image Docker (fusion ndm-sante)
# Build : Vite 6 (frontend React) ; backend server/index.js (CommonJS, Express + PostgreSQL)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-audit --no-fund express@^4.21.2 pg@^8.13.0 nodemailer@^6.9.15 node-cron@^3.0.3
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/fiches-pdf /app/backups
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "server/index.js"]
