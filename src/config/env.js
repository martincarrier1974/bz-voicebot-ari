import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  ARI_URL: z.string().default("http://127.0.0.1:8088"),
  ARI_USER: z.string(),
  ARI_PASS: z.string(),
  ARI_APP: z.string().default("voicebot"),

  RTP_LISTEN_IP: z.string().default("0.0.0.0"),
  RTP_LISTEN_PORT: z.coerce.number().default(40000),
  ASTERISK_PUBLIC_IP: z.string().default("127.0.0.1"),
  /** IP:port pour external_host (si absent, utilise ASTERISK_PUBLIC_IP) */
  MEDIA_SERVER_IP: z.string().optional(),
  RTP_FORMAT: z.string().default("ulaw"),
  SAMPLE_RATE: z.coerce.number().default(8000),
  TIMEZONE: z.string().default("America/Montreal"),

  DEEPGRAM_API_KEY: z.string().optional(),
  DG_STT_MODEL: z.string().default("nova-2"),
  DG_TTS_MODEL: z.string().default("aura-2-agathe-fr"),

  /** Utiliser l'agent conversationnel Deepgram (STT + LLM + TTS) au lieu de STT + règles + TTS */
  USE_DEEPGRAM_AGENT: z.coerce.boolean().default(false),
  /** Clé API OpenAI pour l'agent (think provider) */
  OPENAI_API_KEY: z.string().optional(),
  /** Modèle LLM pour l'agent (ex: gpt-4o-mini, gpt-4o) */
  DG_AGENT_LLM_MODEL: z.string().default("gpt-4o-mini"),
  /** Message de bienvenue de l'agent (parlé au démarrage) */
  DG_AGENT_GREETING: z.string().default("Bienvenue chez BZ Telecom, comment pouvons-nous vous aider aujourd'hui ?"),
  /** Prompt système de l'agent (comportement, ton). Limité à 25000 caractères. */
  DG_AGENT_PROMPT: z.string().optional(),
  /** Fichier JSON publié par l'admin et lu par le voicebot */
  RUNTIME_CONFIG_PATH: z.string().default("runtime/voicebot-config.json"),

  /** Endpoints ARI pour transfert (ex: Local/101@from-internal ou PJSIP/101) */
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

  /** Son/tone joué à la prise d'appel (ex: sound:beep, tone:ring;tonezone=fr) */
  WELCOME_TONE: z.string().optional(),
});

export const env = schema.parse(process.env);
