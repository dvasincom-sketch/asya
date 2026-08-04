// Озвучка ответов Аси через ElevenLabs TTS. Ключ — ELEVENLABS_API_KEY (в env, не в коде).
// Голос: ELEVENLABS_VOICE_ID напрямую, иначе резолвим по имени (ELEVENLABS_VOICE_NAME, дефолт Marina)
// через /v1/voices с кешем в памяти. Никогда не бросает — при сбое возвращает ok:false.

let cachedVoiceId: string | null = null;

export function voiceKey(): string {
  // Ключ для хеша кеша: должен меняться, если сменили голос.
  return process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_NAME || "marina";
}

async function resolveVoiceId(apiKey: string): Promise<string | null> {
  const explicit = process.env.ELEVENLABS_VOICE_ID;
  if (explicit) return explicit;
  if (cachedVoiceId) return cachedVoiceId;
  const name = (process.env.ELEVENLABS_VOICE_NAME || "Marina").toLowerCase();
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
    if (!r.ok) {
      console.warn(`[voice] /v1/voices HTTP ${r.status} — не резолвится голос (задай ELEVENLABS_VOICE_ID)`);
      return null;
    }
    const d = (await r.json()) as { voices?: { voice_id?: string; name?: string }[] };
    const list = d.voices || [];
    const found = list.find((v) => String(v.name || "").toLowerCase() === name) || list[0];
    cachedVoiceId = found?.voice_id || null;
    if (!cachedVoiceId) console.warn("[voice] голос по имени не найден (задай ELEVENLABS_VOICE_ID)");
    return cachedVoiceId;
  } catch (e) {
    console.warn(`[voice] /v1/voices недоступен: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export type TtsResult = { ok: true; audio: Buffer } | { ok: false; reason: string };

export async function synthesize(text: string): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };
  const voiceId = await resolveVoiceId(apiKey);
  if (!voiceId) return { ok: false, reason: "no_voice" };
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

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
      console.warn(`[voice] TTS HTTP ${r.status}: ${detail.slice(0, 200)}`);
      // 401 — ключ, 429 — исчерпана квота ElevenLabs.
      return { ok: false, reason: r.status === 429 ? "quota" : `http_${r.status}` };
    }
    const audio = Buffer.from(await r.arrayBuffer());
    if (!audio.length) return { ok: false, reason: "empty" };
    return { ok: true, audio };
  } catch (e) {
    console.warn(`[voice] TTS исключение: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, reason: "exception" };
  } finally {
    clearTimeout(timer);
  }
}
