-- Документы-контекст проекта (дерево markdown-файлов на проект)
CREATE TABLE IF NOT EXISTS "ProjectDoc" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDoc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDoc_clientId_path_key" ON "ProjectDoc"("clientId", "path");
CREATE INDEX IF NOT EXISTS "ProjectDoc_clientId_updatedAt_idx" ON "ProjectDoc"("clientId", "updatedAt");
