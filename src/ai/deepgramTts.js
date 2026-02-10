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
        ws.send(JSON.stringify({ type: "Close" }));
      });
      ws.on("message", (data) => {
        if (Buffer.isBuffer(data)) {
          chunks.push(data);
        }
      });
      ws.on("close", () => {
        resolve(Buffer.concat(chunks));
      });
      ws.on("error", (err) => {
        log.error({ err }, "Deepgram TTS error");
        reject(err);
      });
    });
  }
}
