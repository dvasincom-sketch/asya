-- CreateTable
CREATE TABLE "VoiceClip" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "chars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceClip_hash_key" ON "VoiceClip"("hash");
