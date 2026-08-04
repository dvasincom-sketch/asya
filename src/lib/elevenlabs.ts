// Озвучка ответов Аси через ElevenLabs TTS. Ключ — ELEVENLABS_API_KEY (в env, не в коде).
// Голос: ELEVENLABS_VOICE_ID напрямую, иначе резолвим по имени (ELEVENLABS_VOICE_NAME)
// через /v1/voices, иначе — бесплатный дефолтный голос. Никогда не бросает — при сбое ok:false.

// Бесплатные встроенные голоса ElevenLabs (доступны и на free-плане). Library-голоса
// (как «Marina») требуют платной подписки и дают 402 — поэтому дефолт здесь бесплатный.
// Sarah — мягкий тёплый женский голос; хорошо ложится на многоязычную модель для русского.
const FREE_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah (free/premade)

let cachedVoiceId: string | null = null;

export function voiceKey(): string {
  // Ключ для хеша кеша: должен меняться, если сменили голос.
  return process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_NAME || FREE_DEFAULT_VOICE;
}

async function resolveVoiceId(apiKey: string): Promise<string | null> {
  const explicit = process.env.ELEVENLABS_VOICE_ID;
  if (explicit) return explicit;
  const name = (process.env.ELEVENLABS_VOICE_NAME || "").trim().toLowerCase();
  // Имя не задано — используем бесплатный дефолт напрямую, без лишнего запроса.
  if (!name) return FREE_DEFAULT_VOICE;
  if (cachedVoiceId) return cachedVoiceId;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
    if (!r.ok) {
      console.warn(`[voice] /v1/voices HTTP ${r.status} — беру бесплатный дефолт`);
      return FREE_DEFAULT_VOICE;
    }
    const d = (await r.json()) as { voices?: { voice_id?: string; name?: string }[] };
    const list = d.voices || [];
    const found = list.find((v) => String(v.name || "").toLowerCase() === name);
    // Если по имени не нашли — не берём случайный (может быть платный library), а бесплатный дефолт.
    cachedVoiceId = found?.voice_id || FREE_DEFAULT_VOICE;
    if (!found) console.warn(`[voice] голос «${name}» не найден — беру бесплатный дефолт`);
    return cachedVoiceId;
  } catch (e) {
    console.warn(`[voice] /v1/voices недоступен: ${e instanceof Error ? e.message : String(e)}`);
    return FREE_DEFAULT_VOICE;
  }
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
    const audio = Buffer.from(await r.arrayBuffer());
    return { status: 200, audio };
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesize(text: string): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };
  const voiceId = await resolveVoiceId(apiKey);
  if (!voiceId) return { ok: false, reason: "no_voice" };
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

  try {
    let res = await ttsOnce(voiceId, text, model, apiKey);
    // Голос требует платного плана (library) — самолечение: повторяем бесплатным дефолтом.
    if (res.status === 402 && voiceId !== FREE_DEFAULT_VOICE) {
      console.warn(`[voice] голос ${voiceId} требует платного плана (402) — повтор бесплатным ${FREE_DEFAULT_VOICE}`);
      cachedVoiceId = FREE_DEFAULT_VOICE;
      res = await ttsOnce(FREE_DEFAULT_VOICE, text, model, apiKey);
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
