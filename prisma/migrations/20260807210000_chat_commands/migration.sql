-- Пользовательские команды чата (JSON [{cmd, reply}]).
ALTER TABLE "ChatConfig" ADD COLUMN IF NOT EXISTS "commands" TEXT;
