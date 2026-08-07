// Живой источник знаний из открытого GitHub-репозитория проекта.
// Ася подтягивает README и верхнеуровневые *.md, чтобы отвечать по актуальной версии проекта.
// Кэш в памяти с TTL, чтобы не упираться в лимиты GitHub. Токен (GITHUB_TOKEN) не обязателен.

type RepoRef = { owner: string; repo: string };

export function parseRepo(url?: string | null): RepoRef | null {
  if (!url) return null;
  const s = url.trim();
  // owner/repo
  let m = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(s);
  if (m && !s.includes("://") && !s.includes("github.com")) return { owner: m[1], repo: m[2] };
  // git@github.com:owner/repo(.git)
  m = /git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  // https://github.com/owner/repo(/...)(.git)
  m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

function ghHeaders(raw = false): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "asya-bot" };
  h["Accept"] = raw ? "application/vnd.github.raw+json" : "application/vnd.github+json";
  const token = process.env.GITHUB_TOKEN;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function ghFetch(url: string, raw = false, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: ghHeaders(raw), signal: ctrl.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

type ContentItem = { name?: string; type?: string; download_url?: string | null };

const CACHE = new Map<string, { text: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;
const MAX_CHARS = 6000;

// Собрать контекст репозитория: README + до 3 верхнеуровневых .md. Пусто при ошибке.
export async function fetchRepoContext(url?: string | null): Promise<string> {
  const ref = parseRepo(url);
  if (!ref) return "";
  const key = `${ref.owner}/${ref.repo}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.text;

  const parts: string[] = [];
  const readme = await ghFetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/readme`, true);
  if (readme) parts.push(`# README\n${readme.trim()}`);

  const listing = await ghFetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/contents`, false);
  if (listing) {
    try {
      const items = JSON.parse(listing) as ContentItem[];
      const docs = Array.isArray(items)
        ? items.filter((i) => i.type === "file" && /\.mdx?$/i.test(i.name || "") && !/^readme\.mdx?$/i.test(i.name || "")).slice(0, 3)
        : [];
      for (const d of docs) {
        if (!d.download_url) continue;
        const body = await ghFetch(d.download_url, false);
        if (body) parts.push(`# ${d.name}\n${body.trim()}`);
        if (parts.join("\n\n").length > MAX_CHARS) break;
      }
    } catch {
      // не смогли разобрать листинг — ограничимся README
    }
  }

  const text = parts.join("\n\n").slice(0, MAX_CHARS);
  CACHE.set(key, { text, at: now });
  return text;
}
