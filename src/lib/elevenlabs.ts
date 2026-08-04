// Озвучка ответов Аси через ElevenLabs TTS. Ключ — ELEVENLABS_API_KEY (в env, не в коде).
// Голос: ELEVENLABS_VOICE_ID напрямую; иначе берём из аккаунта встроенный (premade) голос —
// именно их отдаёт бесплатный план. Library-голоса (как «Marina») требуют платного плана и дают 402.
// Никогда не бросает — при сбое возвращает ok:false.

// Универсальный запасной premade-голос (Rachel) — валиден почти в любом аккаунте, бесплатный.
const HARD_FALLBACK_VOICE = "21m00Tcm4TlvDq8ikWAM";

let cachedFreeVoice: string | null = null;

export function voiceKey(): string {
  // Ключ для хеша кеша: меняется, если сменили голос.
  return process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_NAME || "free";
}

type ApiVoice = { voice_id?: string; name?: string; category?: string; labels?: Record<string, string> };

// Гарантированно бесплатный голос: из /v1/voices выбираем category=premade
// (по имени ELEVENLABS_VOICE_NAME, иначе женский, иначе первый). Кешируем.
async function resolveFreeVoice(apiKey: string): Promise<string> {
  if (cachedFreeVoice) return cachedFreeVoice;
  const wantName = (process.env.ELEVENLABS_VOICE_NAME || "").trim().toLowerCase();
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
    if (r.ok) {
      const d = (await r.json()) as { voices?: ApiVoice[] };
      const list = d.voices || [];
      const premade = list.filter((v) => String(v.category || "").toLowerCase() === "premade");
      const pool = premade.length ? premade : list;
      let pick: ApiVoice | undefined;
      if (wantName) pick = pool.find((v) => String(v.name || "").toLowerCase() === wantName);
      if (!pick) pick = pool.find((v) => String(v.labels?.gender || "").toLowerCase() === "female");
      if (!pick) pick = pool[0];
      if (pick?.voice_id) {
        cachedFreeVoice = pick.voice_id;
        console.warn(`[voice] бесплатный голос: ${pick.name} (${pick.category}) id=${cachedFreeVoice}`);
        return cachedFreeVoice;
      }
      console.warn("[voice] premade-голос в аккаунте не найден — беру универсальный дефолт");
    } else {
      console.warn(`[voice] /v1/voices HTTP ${r.status} — беру универсальный дефолт`);
    }
  } catch (e) {
    console.warn(`[voice] /v1/voices недоступен: ${e instanceof Error ? e.message : String(e)}`);
  }
  cachedFreeVoice = HARD_FALLBACK_VOICE;
  return cachedFreeVoice;
}

export type TtsResult = { ok: true; audio: Buffer } | { ok: false; reason: string };
type RawResult = { status: number; audio?: Buffer; detail?: string };

async function ttsOnce(voiceId: string, text: string, model: string, apiKey: string): Promise<RawResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { status: r.status, detail };
    }
    return { status: 200, audio: Buffer.from(await r.arrayBuffer()) };
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesize(text: string): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  const explicit = process.env.ELEVENLABS_VOICE_ID;
  let voiceId = explicit || (await resolveFreeVoice(apiKey));

  try {
    let res = await ttsOnce(voiceId, text, model, apiKey);

    // 402 = голос платный (library). Самолечение: гарантированно бесплатный premade из аккаунта.
    if (res.status === 402) {
      const free = await resolveFreeVoice(apiKey);
      if (free !== voiceId) {
        console.warn(`[voice] ${voiceId} требует платного плана (402) — повтор бесплатным ${free}`);
        voiceId = free;
        res = await ttsOnce(voiceId, text, model, apiKey);
      }
      // Крайний случай: даже premade из аккаунта 402 — последняя попытка универсальным дефолтом.
      if (res.status === 402 && voiceId !== HARD_FALLBACK_VOICE) {
        console.warn(`[voice] повтор универсальным дефолтом ${HARD_FALLBACK_VOICE}`);
        cachedFreeVoice = HARD_FALLBACK_VOICE;
        voiceId = HARD_FALLBACK_VOICE;
        res = await ttsOnce(voiceId, text, model, apiKey);
      }
    }

    if (res.status !== 200 || !res.audio) {
      console.warn(`[voice] TTS HTTP ${res.status}: ${(res.detail || "").slice(0, 200)}`);
      if (res.status === 429) return { ok: false, reason: "quota" };
      if (res.status === 402) return { ok: false, reason: "paid_plan" };
      return { ok: false, reason: `http_${res.status}` };
    }
    if (!res.audio.length) return { ok: false, reason: "empty" };
    return { ok: true, audio: res.audio };
  } catch (e) {
    console.warn(`[voice] TTS исключение: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, reason: "exception" };
  }
}
