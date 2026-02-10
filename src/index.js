import "./patchSwagger.js";
import { startVoicebot } from "./ari/voicebot.js";
import { log } from "./utils/logger.js";

process.on("unhandledRejection", (e) => {
  log.error({ err: e }, "unhandledRejection");
});

process.on("uncaughtException", (e) => {
  log.error({ err: e }, "uncaughtException");
  // Ne pas crasher: loguer et continuer (évite arrêt du process sur une erreur isolée)
});

await startVoicebot();
