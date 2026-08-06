import { prisma } from "@/lib/prisma";
import { triageCall } from "@/lib/calls";

export const runtime = "nodejs";

// Приём результата звонка от телефонной платформы (Voximplant).
// Тело: { secret, userId?, fromNumber?, fromName?, startedAt?, durationSec?, transcript, recordingUrl? }
export async function POST(req: Request) {
  const secret = process.env.CALLS_WEBHOOK_SECRET;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!secret || body.secret !== secret) return Response.json({ error: "auth" }, { status: 401 });

  const userId = String(body.userId || process.env.CALLS_OWNER_USER_ID || "");
  if (!userId) return Response.json({ error: "no_user" }, { status: 400 });

  const transcript = String(body.transcript || "");
  const fromNumber = body.fromNumber ? String(body.fromNumber) : null;
  const triage = await triageCall(transcript, fromNumber);

  const callDb = (prisma as unknown as {
    call: { create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }> };
  }).call;
  const rec = await callDb
    .create({
      data: {
        userId,
        fromNumber,
        fromName: body.fromName ? String(body.fromName) : null,
        startedAt: body.startedAt ? new Date(String(body.startedAt)) : new Date(),
        durationSec: Number(body.durationSec) || 0,
        transcript: transcript || null,
        summary: triage.summary,
        importance: triage.importance,
        category: triage.category || null,
        recordingUrl: body.recordingUrl ? String(body.recordingUrl) : null,
      },
    })
    .catch(() => null);

  return Response.json({ ok: Boolean(rec), id: rec?.id ?? null });
}
