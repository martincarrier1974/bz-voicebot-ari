type ElevenLabsVoiceApiRecord = {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string | undefined>;
};

export type ElevenLabsVoiceOption = {
  value: string;
  label: string;
  language: string;
};

const FALLBACK_VOICES: ElevenLabsVoiceOption[] = [
  { value: "XB0fDUnXU5powFXDhCwa", label: "Charlotte — EN/FR, feminine", language: "fr/en" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Bella — EN, feminine", language: "en" },
  { value: "ErXwobaYiN019PkySvjV", label: "Antoni — EN, masculine", language: "en" },
  { value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli — EN, feminine", language: "en" },
  { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh — EN, masculine", language: "en" },
  { value: "VR6AewLTigWG4xSOukaG", label: "Arnold — EN, masculine", language: "en" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam — EN, masculine", language: "en" },
  { value: "yoZ06aMxZJJ28mfd3POQ", label: "Sam — EN, neutral", language: "en" },
];

function normalizeVoiceLabel(voice: ElevenLabsVoiceApiRecord): ElevenLabsVoiceOption | null {
  const value = String(voice.voice_id || "").trim();
  const name = String(voice.name || "").trim();
  if (!value || !name) return null;

  const labels = voice.labels || {};
  const language = String(labels.language || labels.locale || labels.lang || "").trim().toLowerCase();
  const accent = String(labels.accent || "").trim();
  const gender = String(labels.gender || "").trim();
  const age = String(labels.age || "").trim();
  const category = String(voice.category || "").trim();

  const meta = [language || null, accent || null, gender || null, age || null, category || null].filter(Boolean);
  return {
    value,
    label: meta.length > 0 ? `${name} — ${meta.join(", ")}` : name,
    language: language || "unknown",
  };
}

function sortVoices(a: ElevenLabsVoiceOption, b: ElevenLabsVoiceOption) {
  const rank = (lang: string) => {
    if (lang.includes("fr")) return 0;
    if (lang.includes("en")) return 1;
    return 2;
  };

  const rankDiff = rank(a.language) - rank(b.language);
  if (rankDiff !== 0) return rankDiff;
  return a.label.localeCompare(b.label, "fr", { sensitivity: "base" });
}

export async function listElevenLabsVoiceOptions(): Promise<ElevenLabsVoiceOption[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return FALLBACK_VOICES;
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs voices fetch failed (${response.status})`);
    }

    const payload = (await response.json()) as { voices?: ElevenLabsVoiceApiRecord[] };
    const options = (payload.voices || [])
      .map(normalizeVoiceLabel)
      .filter((voice): voice is ElevenLabsVoiceOption => Boolean(voice))
      .sort(sortVoices);

    return options.length > 0 ? options : FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
}
