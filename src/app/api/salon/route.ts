import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SALON,
  getCategories,
  getServices,
  getSlots,
  getStaff,
  getNearestSlot,
  createBooking,
  getActiveBookings,
  type CreateBooking,
} from "@/lib/salon";

// Сравниваем телефоны по цифрам: в базах они лежат в разном формате.
function digits(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  return d;
}

export const runtime = "nodejs";

// Прокси к API записи салона. GET — справочники и слоты, POST — создание записи.
export async function GET(req: NextRequest) {
  if (!SALON.enabled) return Response.json({ error: "disabled" }, { status: 503 });

  const p = req.nextUrl.searchParams;
  const action = p.get("action") || "";

  try {
    switch (action) {
      case "info": {
        // Телефон подставляем из профиля — чтобы человеку не набирать его заново.
        const user = await getCurrentUser().catch(() => null);
        return Response.json({ salon: SALON.name, bookingUrl: SALON.bookingUrl, phone: user?.phone ?? null });
      }
      case "categories":
        return Response.json({ items: await getCategories() });
      case "services":
        return Response.json({ items: await getServices(Number(p.get("category_id") || 0)) });
      case "slots":
        return Response.json(
          await getSlots(String(p.get("date") || ""), Number(p.get("duration") || 0), Number(p.get("service_id") || 0)),
        );
      case "staff":
        return Response.json({
          items: await getStaff(
            String(p.get("datetime") || ""),
            Number(p.get("duration") || 0),
            Number(p.get("service_id") || 0),
          ),
        });
      case "nearest":
        return Response.json(await getNearestSlot(Number(p.get("duration") || 3600), Number(p.get("service_id") || 0)));
      case "bookings": {
        // Записи — персональные данные. Отдаём только на номер, подтверждённый входом по SMS.
        const user = await getCurrentUser().catch(() => null);
        if (!user) return Response.json({ needAuth: true, items: [] });
        if (!user.phone) return Response.json({ needPhone: true, items: [] });

        const asked = p.get("phone");
        if (asked && digits(asked) !== digits(user.phone)) {
          // Спросили про чужой номер — не раскрываем и мягко объясняем почему.
          return Response.json({ otherPhone: true, items: [] });
        }

        const items = await getActiveBookings(user.phone);
        return Response.json({ items, phone: user.phone });
      }
      default:
        return Response.json({ error: "bad_action" }, { status: 400 });
    }
  } catch (e) {
    console.error(`[api/salon] ${action}:`, e);
    return Response.json(
      { error: "upstream", text: "Не получилось связаться с расписанием салона. Попробуй чуть позже." },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!SALON.enabled) return Response.json({ error: "disabled" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as (CreateBooking & { client_email?: string }) | null;
  if (!body || !body.service_id || !body.datetime || !body.client_name || !body.client_phone) {
    return Response.json({ error: "bad_request", text: "Не хватает данных для записи." }, { status: 400 });
  }

  try {
    const res = await createBooking({
      service_id: Number(body.service_id),
      service_title: String(body.service_title || ""),
      datetime: String(body.datetime),
      duration: Number(body.duration || 0),
      total_price: Number(body.total_price || 0),
      master_id: Number(body.master_id || 0),
      master_name: String(body.master_name || ""),
      client_name: String(body.client_name).slice(0, 120),
      client_phone: String(body.client_phone).slice(0, 30),
      client_email: body.client_email ? String(body.client_email).slice(0, 120) : "",
    });

    // Запоминаем факт записи — Ася сможет потом бережно спросить, как всё прошло.
    const user = await getCurrentUser().catch(() => null);
    if (user?.memoryEnabled) {
      const when = String(body.datetime);
      const memDb = prisma.memory as unknown as {
        create: (a: { data: { userId: string; fact: string; topic?: string | null } }) => Promise<unknown>;
      };
      await memDb
        .create({
          data: {
            userId: user.id,
            fact: `Записалась в ${SALON.name}: ${body.service_title} — ${when}`.slice(0, 200),
            topic: "Забота о себе",
          },
        })
        .catch(() => {});
    }

    return Response.json(res);
  } catch (e) {
    console.error("[api/salon] create:", e);
    return Response.json(
      { error: "upstream", text: "Не получилось оформить запись. Попробуй ещё раз или открой запись на сайте." },
      { status: 502 },
    );
  }
}
