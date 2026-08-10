-- Внешние проекты, которые дёргают API Аси по ключу. У каждого своя инструкция (как отвечать).
CREATE TABLE IF NOT EXISTS "ApiClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "capability" TEXT NOT NULL DEFAULT 'summary',
    "instruction" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiClient_token_key" ON "ApiClient"("token");
