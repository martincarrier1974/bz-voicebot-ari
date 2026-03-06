import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { linear16ToMulaw8k } from "../utils/audioConvert.js";

const AGENT_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEP_ALIVE_INTERVAL_MS = 5000;

/** Prompt système par défaut (agent téléphonique BZ Telecom – routage). */
const DEFAULT_AGENT_PROMPT = `Tu es l'agent téléphonique IA de BZ Telecom.

Tu parles à des clients au téléphone au Québec. La conversation doit être naturelle, simple, chaleureuse et fluide.
Tu peux faire un vrai transfert d'appel avec la fonction "transfert".
Quand l'intention est claire, tu dois transférer l'appel sans faire perdre de temps au client.
Ne dis jamais que tu ne peux pas transférer.

Accueil :
"BZ Telecom, bonjour, comment puis-je vous aider aujourd'hui ?"

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
- utilise un français québécois naturel et professionnel
- privilégie des formulations comme "bien sûr", "pas de problème", "je vous transfère", "un instant"

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
- "Pas de problème."
- "Un instant."
- "Je vous mets en relation avec la bonne personne."

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

Réponds toujours uniquement en français oral naturel, avec un ton professionnel québécois.`;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDefaultRoutes() {
  return [
    { serviceName: "soutien technique", extension: "101", keywords: ["support", "soutien", "technique"], priority: 10 },
    { serviceName: "ventes et soumissions", extension: "102", keywords: ["vente", "soumission", "prix"], priority: 20 },
    { serviceName: "réception", extension: "105", keywords: ["réception", "accueil", "autre"], priority: 30 },
  ];
}

function getPrimaryFlow(runtimeConfig) {
  return Array.isArray(runtimeConfig?.flows) && runtimeConfig.flows.length > 0 ? runtimeConfig.flows[0] : null;
}

function getFallbackRoute(runtimeConfig, routes) {
  const primaryFlow = getPrimaryFlow(runtimeConfig);
  const flowDestination = primaryFlow?.destinationPost ? routes.find((route) => route.extension === String(primaryFlow.destinationPost)) : null;
  if (flowDestination) return flowDestination;
  const receptionRoute = routes.find((route) => normalizeText(route.serviceName).includes("reception"));
  if (receptionRoute) return receptionRoute;
  const ext105 = routes.find((route) => route.extension === "105");
  return ext105 ?? routes[routes.length - 1] ?? null;
}

function buildGreetingFromRuntime(runtimeConfig) {
  const primaryFlow = getPrimaryFlow(runtimeConfig);
  return runtimeConfig?.prompts?.greeting || primaryFlow?.welcomeMessage || "";
}

function buildPromptFromRuntime(runtimeConfig, routes) {
  if (!runtimeConfig) return "";

  const companyName = runtimeConfig.companyName || "BZ Telecom";
  const primaryFlow = getPrimaryFlow(runtimeConfig);
  const fallbackRoute = getFallbackRoute(runtimeConfig, routes);
  const maxFailedAttempts = primaryFlow?.maxFailedAttempts ?? 2;
  const routeLines = routes.map((route) => {
    const keywords = Array.isArray(route.keywords) && route.keywords.length > 0
      ? ` Mots-clés fréquents : ${route.keywords.join(", ")}.`
      : "";
    return `- ${route.serviceName} = poste ${route.extension}.${keywords}`;
  });
  const intentLines = Array.isArray(primaryFlow?.intents) && primaryFlow.intents.length > 0
    ? primaryFlow.intents.map((intent) => {
      const keywords = Array.isArray(intent.keywords) && intent.keywords.length > 0 ? intent.keywords.join(", ") : "aucun";
      return `- ${intent.label} -> poste ${intent.destinationPost}. Mots-clés : ${keywords}. Réponse courte suggérée : ${intent.response}`;
    })
    : [];

  return [
    `Tu es l'agent téléphonique IA de ${companyName}.`,
    "Tu parles à des clients au téléphone au Québec. La conversation doit être naturelle, simple, chaleureuse et fluide.",
    "Tu peux faire un vrai transfert d'appel avec la fonction \"transfert\". Quand l'intention est claire, tu dois transférer l'appel rapidement.",
    buildGreetingFromRuntime(runtimeConfig) ? `Accueil exact à utiliser : "${buildGreetingFromRuntime(runtimeConfig)}"` : "",
    routes.length > 0 ? `Routage actif :\n${routeLines.join("\n")}` : "",
    primaryFlow?.silencePrompt ? `Si le client reste silencieux, utilise cette relance : "${primaryFlow.silencePrompt}"` : "",
    primaryFlow?.ambiguousPrompt ? `Si la demande est vague, utilise cette relance : "${primaryFlow.ambiguousPrompt}"` : "",
    primaryFlow?.fallbackPrompt ? `Si la compréhension échoue, utilise ce fallback : "${primaryFlow.fallbackPrompt}"` : "",
    fallbackRoute
      ? `Après ${maxFailedAttempts} tentative(s) de clarification sans intention claire, transfère vers ${fallbackRoute.serviceName} au poste ${fallbackRoute.extension}.`
      : "",
    runtimeConfig?.context?.instructions ? `Instructions métier : ${runtimeConfig.context.instructions}` : "",
    runtimeConfig?.context?.voiceTone ? `Ton vocal souhaité : ${runtimeConfig.context.voiceTone}` : "",
    runtimeConfig?.context?.rules ? `Règles à respecter : ${runtimeConfig.context.rules}` : "",
    runtimeConfig?.context?.limits ? `Limites : ${runtimeConfig.context.limits}` : "",
    runtimeConfig?.context?.responseExamples ? `Exemples de réponses : ${runtimeConfig.context.responseExamples}` : "",
    intentLines.length > 0 ? `Intentions configurées :\n${intentLines.join("\n")}` : "",
    runtimeConfig?.prompts?.main ? `Directives supplémentaires : ${runtimeConfig.prompts.main}` : "",
    "Style de conversation : parle comme un bon agent de réception téléphonique, avec des phrases courtes, naturelles, professionnelles et québécoises.",
    "Avant chaque transfert, dis une seule phrase courte et naturelle, puis appelle immédiatement la fonction \"transfert\" avec le bon poste.",
    "Ne pose pas d'autre question une fois la destination claire. N'utilise jamais de markdown.",
    "Réponds toujours uniquement en français oral naturel.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

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
    this.onEvent = typeof options.onEvent === "function" ? options.onEvent : null;
    this.runtimeConfig = options.runtimeConfig ?? null;
    this._routes = Array.isArray(options.routes) && options.routes.length > 0 ? options.routes : getDefaultRoutes();
    this.agentGreeting = options.greeting ?? (buildGreetingFromRuntime(this.runtimeConfig) || null);
    this.agentPrompt = options.prompt ?? (buildPromptFromRuntime(this.runtimeConfig, this._routes) || null);
    this.ws = null;
    this._settingsApplied = false;
    this._keepAliveId = null;
    this._outputSampleRate = 24000;
    this._firstChunkLogged = false;
    this._transferTriggered = false;
  }

  _emitEvent(event) {
    if (!this.onEvent) return;
    try {
      this.onEvent(event);
    } catch (err) {
      log.warn({ err, eventType: event?.type }, "Agent event callback failed");
    }
  }

  /**
   * Construit le message Settings (exemple fourni par l'utilisateur + env).
   */
  _sendSettings() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(this._buildSettings()));
  }

  _buildSettings() {
    const prompt = this.agentPrompt ?? env.DG_AGENT_PROMPT ?? DEFAULT_AGENT_PROMPT;
    const transferExtensions = [...new Set(this._routes.map((route) => String(route.extension).trim()).filter(Boolean))];
    const transferDescription = this._routes
      .map((route) => `${route.extension} = ${route.serviceName}`)
      .join(", ");
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
              description: `Transférer l'appelant vers un poste. À appeler après avoir confirmé oralement le transfert. ${transferDescription}.`,
              parameters: {
                type: "object",
                properties: {
                  poste: {
                    type: "string",
                    enum: transferExtensions,
                    description: `Numéro du poste (${transferExtensions.join(", ")})`,
                  },
                },
                required: ["poste"],
              },
            },
          ],
        },
        greeting: this.agentGreeting ?? env.DG_AGENT_GREETING ?? "Bienvenue chez BZ Telecom, comment pouvons-nous vous aider aujourd'hui ?",
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
      this._emitEvent({ type: "agent_audio_done" });
      return;
    }
    if (t === "AgentStartedSpeaking") {
      this._emitEvent({ type: "agent_audio_start" });
      return;
    }
    if (t === "ConversationText") {
      const role = msg.role;
      const text = msg.content ?? msg.text;
      log.info({ role, text }, "Agent ConversationText");
      this._emitEvent({ type: "conversation_text", role, text });

      // Fallback robuste: si l'agent annonce oralement un transfert mais n'émet pas
      // correctement FunctionCallRequest, on déclenche quand même le vrai transfert.
      if (!this._transferTriggered && role === "assistant" && this.onTransfer && typeof text === "string") {
        const normalized = text.toLowerCase();
        const route = this._matchRouteFromText(text);
        const poste = route?.extension ?? "";

        if (poste && (normalized.includes("je vous transf") || normalized.includes("transfert en cours"))) {
          this._transferTriggered = true;
          this._emitEvent({ type: "transfer_requested", poste, reason: "assistant_text_fallback" });
          log.info({ poste, text, serviceName: route?.serviceName }, "Fallback transfert déclenché depuis la réponse agent");
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
          const route = (() => {
            try {
              const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
              return this._resolveTransferRoute(args);
            } catch {
              return null;
            }
          })();
          const poste = route?.extension ?? "";
          if (!poste) {
            const availableExtensions = this._routes.map((item) => item.extension).join(", ");
            this._sendFunctionCallResponse(fn.id, fn.name, `Poste invalide. Utiliser ${availableExtensions}.`);
            continue;
          }
          this._transferTriggered = true;
          this._emitEvent({ type: "transfer_requested", poste, reason: "function_call" });
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

  _matchRouteFromText(text) {
    const normalizedText = normalizeText(text);
    if (!normalizedText) return null;

    return this._routes.find((route) => {
      if (normalizedText.includes(`poste ${normalizeText(route.extension)}`)) return true;
      if (normalizedText.includes(normalizeText(route.serviceName))) return true;
      return Array.isArray(route.keywords) && route.keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)));
    }) ?? null;
  }

  _resolveTransferRoute(args) {
    if (!args || typeof args !== "object") return null;

    const candidates = [
      args.poste,
      args.extension,
      args.department,
      args.service,
      args.serviceName,
      args.label,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      const byExtension = this._routes.find((route) => route.extension === candidate);
      if (byExtension) return byExtension;

      const byText = this._matchRouteFromText(candidate);
      if (byText) return byText;
    }

    return this._matchRouteFromText(JSON.stringify(args));
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
