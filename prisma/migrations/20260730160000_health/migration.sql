-- AlterTable
ALTER TABLE "User" ADD COLUMN     "healthEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "healthConsentAt" TIMESTAMP(3),
ADD COLUMN     "healthConsentVer" TEXT;

-- CreateTable
CREATE TABLE "HealthDoc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'lab',
    "title" TEXT NOT NULL,
    "docDate" TIMESTAMP(3),
    "lab" TEXT,
    "fileName" TEXT,
    "textRaw" TEXT,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMarker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "refText" TEXT,
    "flag" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthDoc_userId_docDate_idx" ON "HealthDoc"("userId", "docDate");

-- CreateIndex
CREATE INDEX "HealthMarker_userId_code_takenAt_idx" ON "HealthMarker"("userId", "code", "takenAt");

-- CreateIndex
CREATE INDEX "HealthMarker_docId_idx" ON "HealthMarker"("docId");

-- CreateIndex
CREATE INDEX "HealthReminder_userId_dueAt_idx" ON "HealthReminder"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "HealthDoc" ADD CONSTRAINT "HealthDoc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMarker" ADD CONSTRAINT "HealthMarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMarker" ADD CONSTRAINT "HealthMarker_docId_fkey" FOREIGN KEY ("docId") REFERENCES "HealthDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthReminder" ADD CONSTRAINT "HealthReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
