-- Звонки: асинхронный ассистент-автоответчик.
CREATE TABLE IF NOT EXISTS "Call" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromNumber" TEXT,
    "fromName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT,
    "summary" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'unknown',
    "category" TEXT,
    "recordingUrl" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Call_userId_createdAt_idx" ON "Call"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
