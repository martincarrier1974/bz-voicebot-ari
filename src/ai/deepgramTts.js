import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

/**
 * Deepgram TTS WebSocket: une connexion par speak(), retourne Buffer mulaw complet.
 */
export class DeepgramTts {
  /**
   * @param {string} text
   * @returns {Promise<Buffer>} audio mulaw 8kHz
   */
  async speak(text) {
    if (!env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY required for TTS");
    const model = env.DG_TTS_MODEL ?? "aura-asteria-en";
    const url = new URL("wss://api.deepgram.com/v1/speak");
    url.searchParams.set("model", model);
    url.searchParams.set("encoding", "mulaw");
    url.searchParams.set("sample_rate", "8000");
    url.searchParams.set("container", "none");

    const ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}` },
    });

    const chunks = [];

    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "Speak", text }));
        setTimeout(() => ws.send(JSON.stringify({ type: "Close" })), 100);
      });
      ws.on("message", (data) => {
        if (Buffer.isBuffer(data)) {
          chunks.push(data);
          return;
        }
        if (typeof data === "string") {
          if (data.startsWith("{")) {
            try {
              const obj = JSON.parse(data);
              const b64 = obj.chunk ?? obj.audio ?? obj.data;
              if (typeof b64 === "string") {
                chunks.push(Buffer.from(b64, "base64"));
              }
            } catch {
              void 0; /* pas du JSON audio */
            }
            return;
          }
          try {
            chunks.push(Buffer.from(data, "base64"));
          } catch {
            void 0; /* pas du base64 */
          }
        }
      });
      ws.on("close", () => {
        const buf = Buffer.concat(chunks);
        log.info({ bytes: buf.length, chunks: chunks.length }, "Deepgram TTS received");
        resolve(buf);
      });
      ws.on("error", (err) => {
        log.error({ err }, "Deepgram TTS error");
        reject(err);
      });
    });
  }
}
