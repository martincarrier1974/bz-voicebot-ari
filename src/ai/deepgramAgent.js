import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { linear16ToMulaw8k } from "../utils/audioConvert.js";

const AGENT_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEP_ALIVE_INTERVAL_MS = 5000;

/** Prompt système par défaut (agent téléphonique BZ Telecom – routage). */
const DEFAULT_AGENT_PROMPT = `Tu es l'agent téléphonique IA de BZ Telecom.

Tu peux faire un vrai transfert d'appel avec la fonction "transfert".
Tu dois utiliser cette fonction quand l'appelant veut être dirigé vers un service.
Ne dis jamais que tu ne peux pas transférer.

Accueil :
"Bienvenue chez BZ Telecom, comment pouvons-nous vous aider aujourd'hui ?"

Routage :
- soutien technique / support = poste 101
- vente / soumission = poste 102
- réception / autres = poste 105

Règles obligatoires :
- Si l'appelant demande le soutien technique, confirme brièvement puis appelle la fonction "transfert" avec le poste "101".
- Si l'appelant demande les ventes, une soumission ou le service commercial, confirme brièvement puis appelle la fonction "transfert" avec le poste "102".
- Si l'appelant demande la réception, un autre service, ou si la demande reste floue après une relance, confirme brièvement puis appelle la fonction "transfert" avec le poste "105".
- Avant chaque transfert, dis toujours une phrase courte de confirmation, par exemple :
  "Je vous transfère au soutien technique au poste 101."
  "Je vous transfère au service des ventes et soumissions au poste 102."
  "Je vous transfère à la réception au poste 105."
- Après cette phrase de confirmation, appelle immédiatement la fonction "transfert".
- Ne pose pas d'autres questions une fois que l'intention de transfert est claire.
- Ne donne pas de dépannage technique détaillé. Ton rôle principal est de diriger l'appel.

Si la demande n'est pas claire, dis exactement :
"Je peux vous aider à diriger votre appel. Par exemple : soutien technique, vente, réception ou autre. Quelle est la raison de votre appel ?"

Style :
- réponses courtes
- polies
- naturelles
- une seule question à la fois
- français oral seulement
- pas de markdown`;

/**
 * Client WebSocket pour l'agent conversationnel Deepgram (STT + LLM + TTS).
 * Envoie l'audio reçu (mulaw 8k) à l'agent, reçoit l'audio de l'agent et le transmet au callback.
 */
export class DeepgramAgent {
  /**
   * @param {(audioMulaw8k: Buffer) => void} onAgentAudio - appelé avec l'audio mulaw 8kHz à jouer vers le RTP
   * @param {{ onTransfer?: (poste: string) => Promise<string> | string }} [options] - si fourni, appelle onTransfer("101"|"102"|"105") pour transfert ARI
   */
  constructor(onAgentAudio, options = {}) {
    this.onAgentAudio = onAgentAudio;
    this.onTransfer = options.onTransfer ?? null;
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
          functions: [
            {
              name: "transfert",
              description: "Transférer l'appelant vers un poste. À appeler après avoir confirmé oralement le transfert. 101 = soutien technique, 102 = vente/soumission, 105 = réception.",
              parameters: {
                type: "object",
                properties: {
                  poste: {
                    type: "string",
                    enum: ["101", "102", "105"],
                    description: "Numéro du poste (101, 102 ou 105)",
                  },
                },
                required: ["poste"],
              },
            },
          ],
        },
        greeting: env.DG_AGENT_GREETING ?? "Bienvenue chez BZ Telecom, comment pouvons-nous vous aider aujourd'hui ?",
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
    if (t === "FunctionCallRequest" && Array.isArray(msg.functions)) {
      for (const fn of msg.functions) {
        log.info({ functionCall: fn }, "Agent FunctionCallRequest reçu");
        const isTransferFunction =
          typeof fn.name === "string" &&
          ["transfert", "transfer", "transfer_call"].includes(fn.name.toLowerCase());
        const isClientSide = fn.client_side !== false;
        if (isClientSide && isTransferFunction && this.onTransfer) {
          let poste = "";
          try {
            const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
            poste = String(args?.poste ?? args?.extension ?? args?.department ?? "").trim();
          } catch {
            poste = "";
          }
          if (poste !== "101" && poste !== "102" && poste !== "105") {
            this._sendFunctionCallResponse(fn.id, fn.name, "Poste invalide. Utiliser 101, 102 ou 105.");
            continue;
          }
          Promise.resolve(this.onTransfer(poste))
            .then((content) => this._sendFunctionCallResponse(fn.id, fn.name, content ?? `Transfert effectué vers le poste ${poste}.`))
            .catch((err) => {
              log.error({ err, poste }, "Transfert ARI échoué");
              this._sendFunctionCallResponse(fn.id, fn.name, `Erreur: ${err?.message ?? "transfert impossible"}.`);
            });
        } else {
          log.warn(
            { name: fn.name, client_side: fn.client_side, hasOnTransfer: Boolean(this.onTransfer) },
            "FunctionCallRequest ignoré"
          );
        }
      }
      return;
    }
    log.debug({ type: t }, "Agent message");
  }

  _sendFunctionCallResponse(id, name, content) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "FunctionCallResponse", id, name, content }));
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
