-- CreateTable
CREATE TABLE "CoachSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachSession_userId_createdAt_idx" ON "CoachSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionTurn_sessionId_idx" ON "SessionTurn"("sessionId");

-- AddForeignKey
ALTER TABLE "CoachSession" ADD CONSTRAINT "CoachSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTurn" ADD CONSTRAINT "SessionTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
