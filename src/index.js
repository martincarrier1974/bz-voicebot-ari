import "./patchSwagger.js";
import { env } from "./config/env.js";
import { startVoicebot } from "./ari/voicebot.js";
import { log } from "./utils/logger.js";

process.on("unhandledRejection", (e) => {
  log.error({ err: e }, "unhandledRejection");
});

process.on("uncaughtException", (e) => {
  log.error({ err: e }, "uncaughtException");
});

const rtpTarget = `${env.MEDIA_SERVER_IP ?? env.ASTERISK_PUBLIC_IP}:${env.RTP_LISTEN_PORT}`;
log.info(
  {
    ARI_URL: env.ARI_URL,
    RTP_target: rtpTarget,
    RTP_LISTEN_PORT: env.RTP_LISTEN_PORT,
    RUNTIME_TENANT: env.RUNTIME_TENANT ?? "(default)",
    RUNTIME_CONFIG_PATH: env.RUNTIME_CONFIG_PATH,
    DEEPGRAM: !!env.DEEPGRAM_API_KEY,
    ELEVENLABS: !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID),
    ELEVENLABS_VOICE_ID: env.ELEVENLABS_VOICE_ID ?? "(non configuré)",
  },
  "Voicebot config (partager ces logs + sortie pendant un appel pour dépannage)"
);

await startVoicebot();
