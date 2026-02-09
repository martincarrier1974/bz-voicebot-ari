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
  RTP_FORMAT: z.string().default("slin16"),
  SAMPLE_RATE: z.coerce.number().default(16000),
  TIMEZONE: z.string().default("America/Montreal"),

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
});

export const env = schema.parse(process.env);
