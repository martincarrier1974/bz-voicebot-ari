import { startVoicebot } from "./ari/voicebot.js";
import { log } from "./utils/logger.js";

process.on("unhandledRejection", (e) => log.error({ err: e }, "unhandledRejection"));
process.on("uncaughtException", (e) => log.error({ err: e }, "uncaughtException"));

await startVoicebot();
