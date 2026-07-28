// Отправка SMS. По умолчанию — sms.ru (простой HTTP API).
// Если SMS_API_ID не задан, код просто пишется в лог сервера (удобно в разработке).
export async function sendSms(phone: string, text: string): Promise<boolean> {
  const apiId = process.env.SMS_API_ID;
  if (!apiId) {
    console.warn(`[SMS] SMS_API_ID не задан. Код бы ушёл на ${phone}: "${text}"`);
    return false;
  }
  const url =
    `https://sms.ru/sms/send?api_id=${apiId}` +
    `&to=${encodeURIComponent(phone)}` +
    `&msg=${encodeURIComponent(text)}&json=1`;
  try {
    const r = await fetch(url);
    const j = (await r.json()) as { status?: string };
    return j?.status === "OK";
  } catch {
    return false;
  }
}
