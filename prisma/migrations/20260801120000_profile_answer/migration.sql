-- CreateTable
CREATE TABLE "ProfileAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileAnswer_userId_idx" ON "ProfileAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAnswer_userId_formId_questionId_key" ON "ProfileAnswer"("userId", "formId", "questionId");

-- AddForeignKey
ALTER TABLE "ProfileAnswer" ADD CONSTRAINT "ProfileAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
