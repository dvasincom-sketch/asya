-- CreateTable
CREATE TABLE "NetworkConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NetworkConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "params" TEXT,
    "blurb" TEXT,
    "shareScope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criteria" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intro" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "candidateOk" BOOLEAN NOT NULL DEFAULT false,
    "requesterOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Intro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkConsent_userId_category_key" ON "NetworkConsent"("userId", "category");
CREATE INDEX "Offer_category_status_idx" ON "Offer"("category", "status");
CREATE INDEX "Offer_userId_idx" ON "Offer"("userId");
CREATE INDEX "RequestPost_category_status_idx" ON "RequestPost"("category", "status");
CREATE INDEX "RequestPost_userId_idx" ON "RequestPost"("userId");
CREATE UNIQUE INDEX "Intro_requestId_offerId_key" ON "Intro"("requestId", "offerId");
CREATE INDEX "Intro_candidateId_status_idx" ON "Intro"("candidateId", "status");
CREATE INDEX "Intro_requesterId_status_idx" ON "Intro"("requesterId", "status");

-- AddForeignKey
ALTER TABLE "NetworkConsent" ADD CONSTRAINT "NetworkConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestPost" ADD CONSTRAINT "RequestPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intro" ADD CONSTRAINT "Intro_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RequestPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intro" ADD CONSTRAINT "Intro_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
