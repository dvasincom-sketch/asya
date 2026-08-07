-- Настройки Аси по каждому чату.
CREATE TABLE IF NOT EXISTS "ChatConfig" (
    "chatId" TEXT NOT NULL,
    "title" TEXT,
    "role" TEXT NOT NULL DEFAULT 'support',
    "space" TEXT NOT NULL DEFAULT 'default',
    "rules" TEXT,
    "repoUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatConfig_pkey" PRIMARY KEY ("chatId")
);
