# --- Сборка ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl нужен Prisma для генерации клиента
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Запуск ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# openssl — для Prisma; curl — чтобы проба доступности могла достучаться до /api/health
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
# Копируем собранное приложение вместе с зависимостями и Prisma-клиентом
COPY --from=builder /app ./
EXPOSE 3000
# Проверка живости: контейнер здоров, когда /api/health отвечает 200 (база не требуется).
HEALTHCHECK --interval=10s --timeout=4s --start-period=45s --retries=8 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# Применяем миграции (с повторными попытками) и стартуем Next.
# Если база временно недоступна — приложение всё равно поднимается.
CMD ["sh", "/app/docker-entrypoint.sh"]
