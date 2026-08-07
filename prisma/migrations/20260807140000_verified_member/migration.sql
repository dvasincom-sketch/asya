-- Проверка новичков по первому сообщению: кто уже прошёл капчу в чате.
CREATE TABLE IF NOT EXISTS "VerifiedMember" (
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerifiedMember_pkey" PRIMARY KEY ("chatId", "userId")
);
