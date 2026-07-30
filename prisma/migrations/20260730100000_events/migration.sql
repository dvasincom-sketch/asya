-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "meta" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_name_ts_idx" ON "Event"("name", "ts");

-- CreateIndex
CREATE INDEX "Event_anonId_idx" ON "Event"("anonId");
