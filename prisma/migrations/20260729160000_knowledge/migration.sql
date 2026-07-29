-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portrait" TEXT,
ADD COLUMN     "portraitAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "topic" TEXT;

-- CreateIndex
CREATE INDEX "Memory_userId_topic_idx" ON "Memory"("userId", "topic");
