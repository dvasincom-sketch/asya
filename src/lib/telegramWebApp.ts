// Клиентский помощник для Telegram Mini App.
type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

export function getTg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

// Мы внутри Telegram Mini App?
export function inTelegram(): boolean {
  const tg = getTg();
  return Boolean(tg && tg.initData);
}

// Инициализация Mini App + тихий вход по Telegram. Возвращает true, если мы внутри Telegram.
export async function initTelegramMiniApp(): Promise<boolean> {
  const tg = getTg();
  if (!tg || !tg.initData) return false;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.("#181120");
    tg.setBackgroundColor?.("#181120");
  } catch {
    /* вне Telegram методов нет — не страшно */
  }
  try {
    await fetch("/api/auth/tg-webapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData }),
    });
  } catch {
    /* вход не удался — покажем обычный поток */
  }
  return true;
}
