import "dotenv/config";
import path from "node:path";
import { z } from "zod";

function deriveRuntimeConfigPath(input) {
  const explicitPath = input.RUNTIME_CONFIG_PATH?.trim();
  if (explicitPath) return explicitPath;

  const tenantSlug = input.RUNTIME_TENANT?.trim();
  if (tenantSlug) {
    return path.posix.join("runtime", "tenants", tenantSlug, "voicebot-config.json");
  }

  return "runtime/voicebot-config.json";
}

const schema = z.object({
  ARI_URL: z.string().default("http://127.0.0.1:8088"),
  ARI_USER: z.string(),
  ARI_PASS: z.string(),
  ARI_APP: z.string().default("voicebot"),

  RTP_LISTEN_IP: z.string().default("0.0.0.0"),
  RTP_LISTEN_PORT: z.coerce.number().default(40000),
  ASTERISK_PUBLIC_IP: z.string().default("127.0.0.1"),
  MEDIA_SERVER_IP: z.string().optional(),
  RTP_FORMAT: z.string().default("ulaw"),
  SAMPLE_RATE: z.coerce.number().default(8000),
  TIMEZONE: z.string().default("America/Montreal"),

  DEEPGRAM_API_KEY: z.string().optional(),
  DG_STT_MODEL: z.string().default("nova-2"),
  DG_TTS_MODEL: z.string().default("aura-2-agathe-fr"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_LANGUAGE: z.string().default("multi"),

  USE_DEEPGRAM_AGENT: z.coerce.boolean().default(false),
  OPENAI_API_KEY: z.string().optional(),
  DG_AGENT_LLM_MODEL: z.string().default("gpt-4o-mini"),
  DG_AGENT_GREETING: z.string().default("Bienvenue chez BZ Telecom, comment pouvons-nous vous aider aujourd'hui ?"),
  DG_AGENT_PROMPT: z.string().optional(),

  RUNTIME_TENANT: z.string().optional(),
  RUNTIME_CONFIG_PATH: z.string().optional(),

  TRANSFER_POSTE_101: z.string().optional(),
  TRANSFER_POSTE_102: z.string().optional(),
  TRANSFER_POSTE_105: z.string().optional(),

  M365_TENANT_ID: z.string().optional(),
  M365_CLIENT_ID: z.string().optional(),
  M365_CLIENT_SECRET: z.string().optional(),

  CAL_SUPPORT: z.string().email().optional(),
  CAL_SALES: z.string().email().optional(),
  CAL_CABLING: z.string().email().optional(),

  APPT_DURATION_MIN: z.coerce.number().default(30),
  BUSINESS_HOURS_START: z.string().default("09:00"),
  BUSINESS_HOURS_END: z.string().default("17:00"),
  APPT_BUFFER_MIN: z.coerce.number().default(15),

  VOICE_AI_API_KEY: z.string().optional(),
  WELCOME_TONE: z.string().optional(),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  RUNTIME_CONFIG_PATH: deriveRuntimeConfigPath(parsed),
};
