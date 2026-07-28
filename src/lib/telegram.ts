// Проверка подписи Telegram Login Widget.
// https://core.telegram.org/widgets/login#checking-authorization
import crypto from "crypto";

export type TgAuth = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  [key: string]: unknown;
};

export function verifyTelegramLogin(data: TgAuth, botToken: string): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${(rest as Record<string, unknown>)[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  if (hmac !== hash) return false;

  // Свежесть: подпись не старше суток.
  const ageSec = Date.now() / 1000 - Number(data.auth_date);
  if (ageSec > 86400) return false;

  return true;
}
