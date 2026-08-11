-- Владелец ключа (пользователь, авторизованный по телефону в портале разработчика)
ALTER TABLE "ApiClient" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
CREATE INDEX IF NOT EXISTS "ApiClient_ownerUserId_idx" ON "ApiClient"("ownerUserId");
