-- CreateTable
CREATE TABLE "HealthTermInfo" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthTermInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthTermInfo_key_key" ON "HealthTermInfo"("key");

-- CreateIndex
CREATE INDEX "HealthTermInfo_code_idx" ON "HealthTermInfo"("code");
