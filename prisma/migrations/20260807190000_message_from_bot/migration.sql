-- Отмечаем сообщения, которые отправила сама Ася (для метрики «сообщений от Аси»).
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fromBot" BOOLEAN NOT NULL DEFAULT false;
