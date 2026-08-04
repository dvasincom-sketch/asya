-- Мягкое удаление аккаунта: архив с восстановлением, полное удаление отложенно.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
