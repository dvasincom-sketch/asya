-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderCadence" TEXT,
ADD COLUMN     "lastRemindedAt" TIMESTAMP(3);
