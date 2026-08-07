-- Возможности бота хранятся прямо у проекта (чата): роль перестаёт быть глобальным шаблоном.
ALTER TABLE "ChatConfig" ADD COLUMN IF NOT EXISTS "caps" TEXT;
