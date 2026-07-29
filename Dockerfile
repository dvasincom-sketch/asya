# --- Сборка ---
FROM node:20-bookworm-slim AS builder
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
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Копируем собранное приложение вместе с зависимостями и Prisma-клиентом
COPY --from=builder /app ./
EXPOSE 3000
# Применяем миграции к проду и стартуем Next (слушает переменную PORT)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
