export const runtime = "nodejs";

// Лёгкий пинг без обращения к базе — чтобы держать контейнер «тёплым»
// (внешний аптайм-монитор дергает этот адрес раз в несколько минут).
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
