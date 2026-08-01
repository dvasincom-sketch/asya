-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "skill" TEXT;

-- CreateIndex
CREATE INDEX "Message_userId_skill_createdAt_idx" ON "Message"("userId", "skill", "createdAt");
