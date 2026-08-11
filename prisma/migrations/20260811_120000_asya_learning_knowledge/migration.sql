-- Правки редактора проекта (few-shot обучение саммари)
CREATE TABLE "ProjectCorrection" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "source" TEXT,
  "title" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'summary',
  "before" TEXT,
  "after" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectCorrection_clientId_createdAt_idx" ON "ProjectCorrection"("clientId", "createdAt");

-- Знание Аси по видео (саммари + главы с таймкодами)
CREATE TABLE "VideoKnowledge" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "title" TEXT,
  "url" TEXT,
  "summary" TEXT,
  "chapters" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoKnowledge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoKnowledge_clientId_source_key" ON "VideoKnowledge"("clientId", "source");
CREATE INDEX "VideoKnowledge_clientId_updatedAt_idx" ON "VideoKnowledge"("clientId", "updatedAt");
