import "./patchSwagger.js";
import { env } from "./config/env.js";
import { startVoicebot } from "./ari/voicebot.js";
import { log } from "./utils/logger.js";

process.on("unhandledRejection", (e) => {
  log.error({ err: e }, "unhandledRejection");
});

process.on("uncaughtException", (e) => {
  log.error({ err: e }, "uncaughtException");
  // Ne pas crasher: loguer et continuer (évite arrêt du process sur une erreur isolée)
});

// Résumé au démarrage (pour partager les logs et diagnostiquer)
const rtpTarget = `${env.MEDIA_SERVER_IP ?? env.ASTERISK_PUBLIC_IP}:${env.RTP_LISTEN_PORT}`;
log.info(
  {
    ARI_URL: env.ARI_URL,
    RTP_target: rtpTarget,
    RTP_LISTEN_PORT: env.RTP_LISTEN_PORT,
    DEEPGRAM: !!env.DEEPGRAM_API_KEY,
  },
  "Voicebot config (partager ces logs + sortie pendant un appel pour dépannage)"
);

await startVoicebot();
