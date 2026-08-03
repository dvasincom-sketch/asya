// Устойчивость горячих путей к «морганиям» Postgres.
// Главная боль проекта — не нагрузка, а краткие окна недоступности/сети (P1001 и т.п.).
// withDb оборачивает запрос таймаутом и парой коротких ретраев ТОЛЬКО на транзиентных
// ошибках БД; при исчерпании — возвращает fallback, чтобы вызывающий код не 500-ил и не
// показывал пустой экран. Прикладные ошибки (дрейф схемы P2022, нарушение уникальности)
// НЕ ретраятся — сразу в fallback, потому что повтор их не вылечит.

// Транзиентные коды Prisma (инициализация/сеть) и характерные сетевые ошибки узла.
const TRANSIENT_CODE = /^P1(00[0-9]|01[0-7])$/; // P1000..P1017 — доступность/подключение
const TRANSIENT_MSG =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|Connection (?:refused|reset|closed|terminated)|terminating connection|Can't reach database|Timed out fetching a new connection|connection pool/i;

export function isTransient(e: unknown): boolean {
  if (!e) return false;
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_CODE.test(code)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return TRANSIENT_MSG.test(msg);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Гонка запроса с таймаутом: если БД «залипла» (не ошибка, а зависание), не держим
// пользователя — отдаём управление. Подлежащий запрос завершится в фоне сам.
class DbTimeout extends Error {
  constructor() {
    super("db timeout");
    this.name = "DbTimeout";
  }
}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DbTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Коалесинг лога: один и тот же ярлык ошибки не чаще раза в минуту — без спама в логах.
const lastLog = new Map<string, number>();
function logOnce(label: string, e: unknown): void {
  const now = Date.now();
  const prev = lastLog.get(label) ?? 0;
  if (now - prev < 60_000) return;
  lastLog.set(label, now);
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.warn(`[db:${label}] недоступность БД, отдаю fallback — ${msg}`);
}

export async function withDb<T>(
  fn: () => Promise<T>,
  opts: { fallback: T; timeoutMs?: number; retries?: number; label?: string },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 2500;
  const retries = opts.retries ?? 2;
  const label = opts.label ?? "query";
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (e) {
      lastErr = e;
      const transient = e instanceof DbTimeout || isTransient(e);
      if (!transient || attempt === retries) break;
      await sleep(120 * (attempt + 1)); // 120мс, 240мс — короткие паузы, суммарно < 0.5с
    }
  }
  logOnce(label, lastErr);
  return opts.fallback;
}
