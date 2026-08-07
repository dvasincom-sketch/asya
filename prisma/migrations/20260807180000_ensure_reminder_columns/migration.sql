-- Страховочно и идемпотентно добавляем колонки напоминаний.
-- На части боевых БД миграция reminder_cadence числится применённой, но колонки отсутствуют
-- (следствие baseline/resolve) — из-за чего в логах была ошибка "column User.reminderCadence does not exist".
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderCadence" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMP(3);
