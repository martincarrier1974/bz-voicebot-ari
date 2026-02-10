import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

/**
 * Deepgram streaming STT (mulaw 8kHz).
 * Events: onInterim(text), onFinal(text).
 */
export class DeepgramStt {
  constructor() {
    this.ws = null;
    this.onInterimCb = null;
    this.onFinalCb = null;
  }

  onInterim(cb) {
    this.onInterimCb = cb;
  }

  onFinal(cb) {
    this.onFinalCb = cb;
  }

  start() {
    if (!env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY required for STT");
    const model = env.DG_STT_MODEL ?? "nova-2";
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("encoding", "mulaw");
    url.searchParams.set("sample_rate", "8000");
    url.searchParams.set("channels", "1");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("model", model);
    url.searchParams.set("endpointing", "200");

    this.ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}` },
    });

    return new Promise((resolve, reject) => {
      this.ws.on("open", () => {
        log.debug("Deepgram STT connected");
        resolve();
      });
      this.ws.on("error", (err) => {
        log.error({ err }, "Deepgram STT error");
        reject(err);
      });
      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "Results" && msg.channel?.alternatives?.[0]) {
            const transcript = msg.channel.alternatives[0].transcript?.trim() || "";
            if (!transcript) return;
            if (msg.is_final || msg.speech_final) {
              if (this.onFinalCb) this.onFinalCb(transcript);
            } else if (this.onInterimCb) {
              this.onInterimCb(transcript);
            }
          }
        } catch {
          /* ignore parse errors */
        }
      });
    });
  }

  sendAudio(mulawBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(mulawBuffer);
    }
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }
}
