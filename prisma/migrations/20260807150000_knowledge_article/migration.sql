-- База знаний агента поддержки.
CREATE TABLE IF NOT EXISTS "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "space" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_space_idx" ON "KnowledgeArticle"("space");
