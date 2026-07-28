import { NextRequest } from "next/server";
import { detectCrisis, CRISIS_REPLY, type ChatMessage } from "@/lib/crisis";
import { streamChat, hasKey } from "@/lib/timeweb";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", text: "Некорректный запрос." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Кризисный путь — модель не вызываем, отдаём заранее заготовленную карточку.
  if (lastUser && detectCrisis(String(lastUser.content))) {
    return Response.json(CRISIS_REPLY);
  }

  if (!hasKey()) {
    return Response.json(
      { error: "no_key", text: "Ключ Timeweb AI Gateway не задан. Добавь TIMEWEB_API_KEY в .env." },
      { status: 503 },
    );
  }

  try {
    const upstream = await streamChat(messages);
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return Response.json(
        { error: "upstream", text: "Не получилось связаться с моделью.", detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    // Прозрачно прокидываем SSE-поток модели в браузер.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "server", text: "Что-то пошло не так на сервере." }, { status: 500 });
  }
}
