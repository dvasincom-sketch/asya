-- Кэш кратких содержаний видео (транскрипт → Ася → саммари). Ключ кэша — хэш транскрипта+опций.
CREATE TABLE IF NOT EXISTS "VideoSummary" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT,
    "source" TEXT,
    "lang" TEXT,
    "summary" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VideoSummary_hash_key" ON "VideoSummary"("hash");
