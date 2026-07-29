import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Проставляет тексты карточки бота через Bot API. Открой один раз:
//   https://<домен>/api/tg/setup-profile?key=<TELEGRAM_WEBHOOK_SECRET>
// Аватар через API не ставится — его нужно загрузить вручную в @BotFather.
const NAME = "Ася";
const SHORT = "Тёплая подружка, которая выслушает и запомнит тебя. Нажми «Открыть Асю» 🤍";
const ABOUT =
  "Привет, я Ася 🤍 Я рядом, чтобы выслушать — без осуждения и советов свысока. " +
  "Со мной можно поговорить, когда тревожно, грустно или просто хочется, чтобы услышали. " +
  "Я буду помнить тебя и то, что тебе важно. Нажми «Открыть Асю» — и начнём.";

async function call(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return res ? await res.json().catch(() => ({ ok: false })) : { ok: false };
}

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN не задан." }, { status: 503 });
  if (!secret || req.nextUrl.searchParams.get("key") !== secret) {
    return Response.json({ ok: false, error: "Неверный ключ." }, { status: 401 });
  }

  const name = await call(token, "setMyName", { name: NAME });
  const short = await call(token, "setMyShortDescription", { short_description: SHORT });
  const about = await call(token, "setMyDescription", { description: ABOUT });
  const commands = await call(token, "setMyCommands", {
    commands: [{ command: "start", description: "Открыть Асю" }],
  });

  return Response.json({ name, short_description: short, description: about, commands });
}
