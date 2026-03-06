import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { linear16ToMulaw8k } from "../utils/audioConvert.js";

const AGENT_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEP_ALIVE_INTERVAL_MS = 5000;

/** Prompt système par défaut (assistant téléphonique BZ Telecom). */
const DEFAULT_AGENT_PROMPT = `#Rôle
Tu es l'assistant vocal de BZ Telecom. Tu réponds au téléphone de manière chaleureuse et professionnelle.

#Directives
- Réponds en français, de façon claire et concise.
- Limite tes réponses à 1–2 phrases sauf si le client demande plus de détails.
- Pas de formatage markdown (gras, liens, listes à puces).
- Si la demande est floue, demande une précision.
- Si tu ne peux pas aider (conseil juridique, médical, financier), dis-le poliment et propose d'orienter vers un professionnel.

#Objectif
Accueillir l'appelant, comprendre sa demande (rendez-vous, information, support) et l'aider ou le rediriger.`;

/**
 * Client WebSocket pour l'agent conversationnel Deepgram (STT + LLM + TTS).
 * Envoie l'audio reçu (mulaw 8k) à l'agent, reçoit l'audio de l'agent et le transmet au callback.
 */
export class DeepgramAgent {
  /**
   * @param {(audioMulaw8k: Buffer) => void} onAgentAudio - appelé avec l'audio mulaw 8kHz à jouer vers le RTP
   */
  constructor(onAgentAudio) {
    this.onAgentAudio = onAgentAudio;
    this.ws = null;
    this._settingsApplied = false;
    this._keepAliveId = null;
    this._outputSampleRate = 24000;
    this._firstChunkLogged = false;
  }

  /**
   * Construit le message Settings (exemple fourni par l'utilisateur + env).
   */
  _sendSettings() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(this._buildSettings()));
  }

  _buildSettings() {
    const prompt = env.DG_AGENT_PROMPT ?? DEFAULT_AGENT_PROMPT;
    const settings = {
      type: "Settings",
      audio: {
        input: {
          encoding: "mulaw",
          sample_rate: 8000,
        },
        output: {
          encoding: "linear16",
          sample_rate: 24000,
          container: "none",
        },
      },
      agent: {
        language: "fr",
        speak: {
          provider: {
            type: "deepgram",
            model: env.DG_TTS_MODEL ?? "aura-2-agathe-fr",
          },
        },
        listen: {
          provider: {
            type: "deepgram",
            version: "v1",
            model: env.DG_STT_MODEL ?? "nova-3",
          },
        },
        think: {
          provider: {
            type: "open_ai",
            model: env.DG_AGENT_LLM_MODEL ?? "gpt-4o-mini",
          },
          prompt,
        },
        greeting: env.DG_AGENT_GREETING ?? "Bienvenue chez BZ Telecom. Comment puis-je vous aider?",
      },
    };
    return settings;
  }

  async connect() {
    if (!env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY required for Agent");
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(AGENT_WS_URL, {
        headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}` },
      });

      this.ws.on("open", () => {
        log.info("Deepgram Agent WebSocket connected");
        this._sendSettings();
      });

      this.ws.on("message", (data) => {
        const isBuffer = Buffer.isBuffer(data);
        const isString = typeof data === "string";
        if (isBuffer && data.length < 500 && data[0] === 0x7b) {
          try {
            const msg = JSON.parse(data.toString("utf8"));
            log.info({ type: msg.type, len: data.length }, "Agent: message (JSON en binaire)");
            this._handleServerMessage(msg, resolve, reject);
            return;
          } catch {
            void 0; /* JSON invalide, ignorer */
          }
        }
        if (isString) {
          try {
            const msg = JSON.parse(data);
            log.info({ type: msg.type }, "Agent: message (texte)");
            this._handleServerMessage(msg, resolve, reject);
            return;
          } catch (e) {
            log.warn({ err: String(e), preview: data.slice(0, 150) }, "Agent: message texte non-JSON");
            return;
          }
        }
        if (isBuffer && this._settingsApplied && data.length > 0 && this.onAgentAudio) {
          const mulaw8k = linear16ToMulaw8k(Buffer.from(data), this._outputSampleRate);
          if (mulaw8k.length > 0) {
            if (!this._firstChunkLogged) {
              this._firstChunkLogged = true;
              log.info({ linear16: data.length, mulaw8k: mulaw8k.length }, "Agent audio: first chunk (linear16→mulaw)");
            }
            this.onAgentAudio(mulaw8k);
          }
          return;
        }
        if (isBuffer) {
          log.debug({ len: data.length, settingsApplied: this._settingsApplied }, "Agent: message binaire ignoré");
        }
      });

      this.ws.on("close", (code, reason) => {
        this._stopKeepAlive();
        log.info({ code, reason: reason?.toString() || reason }, "Deepgram Agent WebSocket closed");
      });

      this.ws.on("error", (err) => {
        log.error({ err }, "Deepgram Agent WebSocket error");
        reject(err);
      });
    });
  }

  _handleServerMessage(msg, resolve, reject) {
    const t = msg.type;
    if (t === "Welcome") {
      log.info("Deepgram Agent Welcome received (Settings déjà envoyés à l'ouverture)");
      return;
    }
    if (t === "SettingsApplied") {
      this._settingsApplied = true;
      this._startKeepAlive();
      log.info("Deepgram Agent SettingsApplied, ready for audio");
      resolve();
      return;
    }
    if (t === "Error") {
      const errMsg = msg.message ?? msg.description ?? msg.error ?? JSON.stringify(msg);
      log.error({ code: msg.code, message: msg.message, description: msg.description, full: msg }, "Deepgram Agent Error");
      reject(new Error(errMsg));
      return;
    }
    if (t === "Warning") {
      log.warn({ code: msg.code, message: msg.message, description: msg.description, full: msg }, "Deepgram Agent Warning");
      return;
    }
    if (t === "AgentAudioDone") {
      return;
    }
    if (t === "AgentStartedSpeaking") {
      return;
    }
    if (t === "ConversationText") {
      log.info({ role: msg.role, text: msg.content ?? msg.text }, "Agent ConversationText");
      return;
    }
    log.debug({ type: t }, "Agent message");
  }

  _startKeepAlive() {
    this._stopKeepAlive();
    this._keepAliveId = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  _stopKeepAlive() {
    if (this._keepAliveId != null) {
      clearInterval(this._keepAliveId);
      this._keepAliveId = null;
    }
  }

  /**
   * Envoie un chunk audio (mulaw 8kHz) vers l'agent.
   * @param {Buffer} payload
   */
  sendAudio(payload) {
    if (this.ws?.readyState === WebSocket.OPEN && this._settingsApplied && payload?.length) {
      this.ws.send(payload);
    }
  }

  close() {
    this._stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._settingsApplied = false;
  }
}
