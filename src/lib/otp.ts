// Одноразовые коды входа по телефону.
import crypto from "crypto";
import { prisma } from "./prisma";

const TTL_MS = 5 * 60 * 1000; // 5 минут

function genCode(): string {
  return String(crypto.randomInt(100000, 1000000)); // 6 цифр
}

export async function issueOtp(phone: string): Promise<string> {
  const code = genCode();
  await prisma.otpCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return code;
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const rec = await prisma.otpCode.findFirst({
    where: { phone, code },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.expiresAt < new Date()) return false;
  await prisma.otpCode.deleteMany({ where: { phone } }); // код одноразовый
  return true;
}
