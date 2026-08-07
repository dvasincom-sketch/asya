-- Гибкие роли бота: набор возможностей (capabilities) под каждую роль, редактируемо из админки.
CREATE TABLE IF NOT EXISTS "RoleDef" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caps" TEXT NOT NULL DEFAULT '{}',
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleDef_pkey" PRIMARY KEY ("key")
);
