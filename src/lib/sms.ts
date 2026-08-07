// Отправка SMS через sms.ru. Имя отправителя — из SMS_FROM (по умолчанию "asyaon", должно быть согласовано в кабинете sms.ru).
// Если SMS_API_ID не задан — код просто пишется в лог сервера (удобно в разработке).
export type SmsResult = { ok: boolean; reason?: string };

export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  const apiId = process.env.SMS_API_ID;
  if (!apiId) {
    console.warn(`[SMS] SMS_API_ID не задан. Код бы ушёл на ${phone}: "${text}"`);
    return { ok: false, reason: "no_api_id" };
  }
  const from = process.env.SMS_FROM || "asyaon";
  const params = new URLSearchParams({ api_id: apiId, to: phone.replace(/^\+/, ""), msg: text, json: "1" });
  if (from) params.set("from", from);
  try {
    const r = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
    const j = (await r.json()) as {
      status?: string; status_code?: number; status_text?: string; balance?: number;
      sms?: Record<string, { status?: string; status_code?: number; status_text?: string }>;
    };
    const per = j?.sms ? Object.values(j.sms)[0] : undefined;
    const ok = j?.status === "OK" && (!per || per.status === "OK");
    if (ok) {
      console.log(`[SMS] отправлено на ${phone} (from=${from}), баланс=${j?.balance}`);
      return { ok: true };
    }
    const reason = per?.status_text || j?.status_text || `code ${per?.status_code ?? j?.status_code}`;
    console.warn(`[SMS] sms.ru не отправил на ${phone} (from=${from}): ${reason}`);
    return { ok: false, reason };
  } catch (e) {
    console.error("[SMS] ошибка запроса:", e instanceof Error ? e.message : String(e));
    return { ok: false, reason: "network" };
  }
}
