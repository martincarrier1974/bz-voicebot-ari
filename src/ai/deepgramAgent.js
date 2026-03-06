import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { linear16ToMulaw8k } from "../utils/audioConvert.js";

const AGENT_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEP_ALIVE_INTERVAL_MS = 5000;

/** Prompt système par défaut (agent téléphonique BZ Telecom – routage). */
const DEFAULT_AGENT_PROMPT = `Tu es l'agent téléphonique IA de BZ Telecom.

Tu parles à des clients au téléphone. La conversation doit être naturelle, simple, chaleureuse et fluide.
Tu peux faire un vrai transfert d'appel avec la fonction "transfert".
Quand l'intention est claire, tu dois transférer l'appel sans faire perdre de temps au client.
Ne dis jamais que tu ne peux pas transférer.

Accueil :
"Bienvenue chez BZ Telecom, comment puis-je vous aider aujourd'hui ?"

Routage :
- soutien technique / support = poste 101
- vente / soumission / commercial = poste 102
- réception / autre / demande non claire après relance = poste 105

Style de conversation :
- parle comme un bon agent de réception téléphonique
- fais des phrases courtes et naturelles
- sois poli, calme et humain
- une seule question à la fois
- évite les répétitions
- n'utilise jamais de markdown
- n'utilise pas de phrases inutiles comme "..." ou des silences écrits
- n'utilise pas de formulations robotiques

Règles de conduite :
- si la demande est claire dès la première phrase, confirme brièvement puis transfère
- si la demande est un peu vague, pose une seule question courte pour clarifier
- si le client reste imprécis après une relance, transfère à la réception au poste 105
- ne fais pas de dépannage technique détaillé
- ton rôle principal est de comprendre rapidement l'intention et de diriger l'appel

Phrases naturelles à privilégier :
- "Bien sûr."
- "D'accord."
- "Je comprends."
- "Très bien."

Avant chaque transfert, dis une seule phrase courte et naturelle :
- "Je vous transfère au soutien technique au poste 101."
- "Je vous transfère au service des ventes et soumissions au poste 102."
- "Je vous transfère à la réception au poste 105."

Après cette phrase, appelle immédiatement la fonction "transfert" avec le bon poste.
Ne pose pas d'autre question une fois la destination claire.

Si la demande n'est pas claire, dis :
"Je peux vous aider à diriger votre appel. Par exemple : soutien technique, vente, réception ou autre. Quelle est la raison de votre appel ?"

Exemples :
- Si le client dit "J'ai un problème avec mon téléphone", transfère au poste 101.
- Si le client dit "Je veux un prix" ou "je veux parler aux ventes", transfère au poste 102.
- Si le client dit "Je ne sais pas trop" ou "j'appelle pour autre chose", transfère au poste 105.

Réponds toujours uniquement en français oral naturel.`;

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
    this._transferTriggered = false;
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
      const role = msg.role;
      const text = msg.content ?? msg.text;
      log.info({ role, text }, "Agent ConversationText");

      // Fallback robuste: si l'agent annonce oralement un transfert mais n'émet pas
      // correctement FunctionCallRequest, on déclenche quand même le vrai transfert.
      if (!this._transferTriggered && role === "assistant" && this.onTransfer && typeof text === "string") {
        const normalized = text.toLowerCase();
        let poste = "";
        if (normalized.includes("poste 101") || normalized.includes("soutien technique")) poste = "101";
        else if (normalized.includes("poste 102") || normalized.includes("vente") || normalized.includes("soumission")) poste = "102";
        else if (normalized.includes("poste 105") || normalized.includes("réception")) poste = "105";

        if (poste && (normalized.includes("je vous transf") || normalized.includes("transfert en cours"))) {
          this._transferTriggered = true;
          log.info({ poste, text }, "Fallback transfert déclenché depuis la réponse agent");
          Promise.resolve(this.onTransfer(poste))
            .then((content) => {
              log.info({ poste, content }, "Fallback transfert réussi");
            })
            .catch((err) => {
              this._transferTriggered = false;
              log.error({ err, poste }, "Fallback transfert échoué");
            });
        }
      }
      return;
    }
    if (t === "FunctionCallRequest" && Array.isArray(msg.functions)) {
      for (const fn of msg.functions) {
        log.info(
          {
            function_name: fn.name,
            client_side: fn.client_side,
            has_on_transfer: Boolean(this.onTransfer),
            arguments: fn.arguments,
          },
          "Agent FunctionCallRequest reçu"
        );
        const isTransferFunction =
          typeof fn.name === "string" &&
          ["transfert", "transfer", "transfer_call"].includes(fn.name.toLowerCase());
        if (isTransferFunction && this.onTransfer) {
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
          this._transferTriggered = true;
          Promise.resolve(this.onTransfer(poste))
            .then((content) => this._sendFunctionCallResponse(fn.id, fn.name, content ?? `Transfert effectué vers le poste ${poste}.`))
            .catch((err) => {
              this._transferTriggered = false;
              log.error({ err, poste }, "Transfert ARI échoué");
              this._sendFunctionCallResponse(fn.id, fn.name, `Erreur: ${err?.message ?? "transfert impossible"}.`);
            });
        } else {
          log.warn(
            { function_name: fn.name, client_side: fn.client_side, has_on_transfer: Boolean(this.onTransfer) },
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
