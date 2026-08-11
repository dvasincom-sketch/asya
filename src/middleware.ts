import { NextRequest, NextResponse } from "next/server";

// Поддомен api.ася.online — портал разработчика и «чистые» URL эндпоинтов.
// Основной домен не трогаем.
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (!host.startsWith("api.")) return NextResponse.next();

  const url = req.nextUrl;
  const p = url.pathname;

  // Корень поддомена → портал разработчика.
  if (p === "/") return NextResponse.rewrite(new URL("/dev", url));

  // Портал, реальные API-роуты, статика и файлы с расширением — как есть.
  if (p === "/dev" || p.startsWith("/dev/") || p.startsWith("/api/") || p.startsWith("/_next/") || p.includes(".")) {
    return NextResponse.next();
  }

  // Чистые URL эндпоинтов на поддомене: /generate → /api/generate, /summary → /api/summary.
  return NextResponse.rewrite(new URL("/api" + p, url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
