import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { offersDb, requestsDb } from "@/lib/networkDb";
import { detectNetworkIntent } from "@/lib/networkExtract";
import { resolveGender } from "@/lib/address";

export const runtime = "nodejs";

// Ася замечает в разговоре потенциальный оффер/запрос и мягко предлагает оформить.
// Вызывается клиентом ПОСЛЕ ответа Аси (вне горячего пути стрима), как авто-память.
// Ничего не создаёт — только возвращает предложение. Создание — по тапу, отдельным роутом.
export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ kind: "none" });
  const b = await req.json().catch(() => ({}));
  if (b.incognito === true) return Response.json({ kind: "none" });
  const text = String(b.text || "");
  if (!text) return Response.json({ kind: "none" });

  const gender = await resolveGender(u.id).catch(() => null);
  const found = await detectNetworkIntent(text, gender).catch(() => null);
  if (!found) return Response.json({ kind: "none" });

  // Не надоедаем: если по этой категории уже есть оффер (черновик/актив) — не предлагаем оффер;
  // если уже есть открытый запрос — не предлагаем запрос.
  if (found.kind === "offer") {
    const mine = await offersDb().findMany({ where: { userId: u.id, category: found.category }, take: 5 }).catch(() => []);
    if (mine.some((o) => o.status === "active" || o.status === "draft")) return Response.json({ kind: "none" });
  } else {
    const mine = await requestsDb().findMany({ where: { userId: u.id, category: found.category, status: "open" }, take: 5 }).catch(() => []);
    if (mine.length) return Response.json({ kind: "none" });
  }

  return Response.json(found);
}
