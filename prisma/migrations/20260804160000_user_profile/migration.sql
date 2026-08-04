-- Профиль из Telegram для иконки-аватара в шапке чата.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
