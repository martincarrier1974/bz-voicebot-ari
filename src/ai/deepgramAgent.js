import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

const AGENT_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEP_ALIVE_INTERVAL_MS = 5000;

/** Prompt système par défaut (agent téléphonique BZ Telecom – routage). */
const DEFAULT_AGENT_PROMPT = `Tu es l'agent téléphonique IA de BZ Telecom.

Tu parles à des clients au téléphone au Québec. Ta voix doit sonner naturelle, chaleureuse, professionnelle et très fluide.
Tu peux faire un vrai transfert d'appel avec la fonction "transfert".
Quand l'intention est claire, tu dois transférer l'appel rapidement sans faire perdre de temps au client.
Ne dis jamais que tu ne peux pas transférer.

Accueil exact :
"Bonjour, vous êtes chez BZ Telecom. Qu'est-ce que je peux faire pour vous aujourd'hui ?"

Routage :
- soutien technique / support = poste 101
- vente / soumission / commercial = poste 102
- réception / autre / demande non claire après relance = poste 105

Style de conversation :
- parle comme une bonne réceptionniste québécoise au téléphone
- fais des phrases courtes, naturelles et faciles à comprendre
- une seule question à la fois
- reste calme, humain et professionnel
- évite les tournures trop françaises de France ou trop soutenues
- évite les formulations robotiques, scolaires ou trop écrites
- n'utilise jamais de markdown
- n'ajoute jamais de longues explications inutiles
- ne répète pas la même idée deux fois

Ton québécois recherché :
- privilégie un français québécois professionnel et naturel
- tu peux dire par exemple : "bien sûr", "pas de problème", "je regarde ça", "je vous transfère", "un instant"
- garde un ton poli, mais pas raide ni trop formel
- évite des phrases comme "comment puis-je vous assister aujourd'hui"
- préfère des phrases comme "qu'est-ce que je peux faire pour vous", "je vous transfère tout de suite", "je vous envoie au bon service"

Règles de conduite :
- si la demande est claire dès la première phrase, confirme brièvement puis transfère
- si la demande est un peu vague, pose une seule question courte pour clarifier
- si le client reste imprécis après une relance, transfère à la réception au poste 105
- ne fais pas de dépannage technique détaillé
- ton rôle principal est de comprendre rapidement l'intention et de diriger l'appel
- si la destination est claire, ne garde pas la conversation ouverte inutilement

Réponses naturelles à privilégier :
- "Bien sûr."
- "Parfait."
- "D'accord."
- "Je comprends."
- "Pas de problème."
- "Un instant."
- "Je vous transfère tout de suite."

Avant chaque transfert, dis une seule phrase courte et naturelle, puis transfère immédiatement :
- "Parfait, je vous transfère au soutien technique."
- "D'accord, je vous transfère aux ventes."
- "Je vais vous transférer à la réception."

Après cette phrase, appelle immédiatement la fonction "transfert" avec le bon poste.
Ne pose pas d'autre question une fois la destination claire.
N'ajoute pas une deuxième phrase comme "un instant s'il vous plaît" après avoir déjà annoncé le transfert.

Si la demande n'est pas claire, dis :
"Je peux vous aider à diriger votre appel. Est-ce que c'est pour le soutien technique, les ventes ou la réception ?"

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

function getRouteMatchScore(route, text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText || !route) return 0;

  const extension = normalizeText(route.extension);
  const serviceName = normalizeText(route.serviceName);
  const keywords = Array.isArray(route.keywords)
    ? route.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean)
    : [];

  let score = 0;

  if (extension && [extension, `poste ${extension}`, `poste numero ${extension}`, `extension ${extension}`].some((term) => normalizedText.includes(term))) {
    score = Math.max(score, 100);
  }

  if (serviceName) {
    if (normalizedText === serviceName) {
      score = Math.max(score, 98);
    } else if (normalizedText.includes(serviceName)) {
      score = Math.max(score, 92);
    } else if (serviceName.includes(normalizedText)) {
      score = Math.max(score, 78);
    }
  }

  for (const keyword of keywords) {
    if (normalizedText === keyword) {
      score = Math.max(score, 94);
      continue;
    }
    if (normalizedText.includes(keyword) || keyword.includes(normalizedText)) {
      score = Math.max(score, 84);
    }
  }

  const textTokens = new Set(normalizedText.split(/\s+/).filter(Boolean));
  const routeTokens = new Set([serviceName, ...keywords].flatMap((value) => value.split(/\s+/)).filter(Boolean));
  let overlap = 0;
  for (const token of routeTokens) {
    if (textTokens.has(token)) overlap += 1;
  }
  if (routeTokens.size > 0) {
    score = Math.max(score, Math.round((overlap / routeTokens.size) * 100));
  }

  return score;
}


function getDefaultRoutes() {
  return [
    { serviceName: "soutien technique", extension: "101", keywords: ["support", "soutien", "technique"], priority: 10 },
    { serviceName: "ventes et soumissions", extension: "102", keywords: ["vente", "soumission", "prix"], priority: 20 },
    { serviceName: "réception", extension: "105", keywords: ["réception", "accueil", "autre"], priority: 30 },
  ];
}

function getDirectoryRoutesFromRuntimeConfig(runtimeConfig) {
  const contacts = Array.isArray(runtimeConfig?.directoryContacts) ? runtimeConfig.directoryContacts : [];
  return contacts
    .filter((contact) => contact?.extension && contact?.name)
    .map((contact) => {
      const aliases = Array.isArray(contact.aliases) ? contact.aliases : [];
      const keywords = [...new Set([contact.name, ...aliases].map((item) => String(item || "").trim()).filter(Boolean))];
      return {
        serviceName: String(contact.name).trim(),
        extension: String(contact.extension).trim(),
        keywords,
        priority: 500,
      };
    });
}

function getRoutesFromRuntimeConfig(runtimeConfig) {
  const configuredRoutes = Array.isArray(runtimeConfig?.routes) ? runtimeConfig.routes : [];
  const baseRoutes = configuredRoutes.length > 0 ? configuredRoutes : getDefaultRoutes();
  const normalizedBaseRoutes = baseRoutes
    .filter((route) => route?.extension)
    .map((route) => ({
      serviceName: String(route.serviceName || `Poste ${route.extension}`).trim(),
      extension: String(route.extension).trim(),
      keywords: Array.isArray(route.keywords) ? route.keywords.map((keyword) => String(keyword).trim()).filter(Boolean) : [],
      priority: Number(route.priority || 999),
    }))
    .sort((a, b) => a.priority - b.priority);

  return [...normalizedBaseRoutes, ...getDirectoryRoutesFromRuntimeConfig(runtimeConfig)];
}

function getPrimaryFlow(runtimeConfig) {
  return Array.isArray(runtimeConfig?.flows) && runtimeConfig.flows.length > 0 ? runtimeConfig.flows[0] : null;
}

function getTtsModelFromRuntime(runtimeConfig) {
  const runtimeModel = runtimeConfig?.settings?.dg_tts_model;
  return typeof runtimeModel === "string" && runtimeModel.trim() ? runtimeModel.trim() : null;
}

function getTtsProviderFromRuntime(runtimeConfig) {
  const provider = runtimeConfig?.settings?.tts_provider;
  if (typeof provider === "string" && provider.trim()) return provider.trim();
  // Fallback: utiliser ElevenLabs si configuré dans .env même sans runtimeConfig
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) return "eleven_labs";
  return "deepgram";
}

function getElevenLabsConfigFromRuntime(runtimeConfig) {
  return {
    modelId: typeof runtimeConfig?.settings?.elevenlabs_model_id === "string" && runtimeConfig.settings.elevenlabs_model_id.trim()
      ? runtimeConfig.settings.elevenlabs_model_id.trim()
      : env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    voiceId: typeof runtimeConfig?.settings?.elevenlabs_voice_id === "string" && runtimeConfig.settings.elevenlabs_voice_id.trim()
      ? runtimeConfig.settings.elevenlabs_voice_id.trim()
      : env.ELEVENLABS_VOICE_ID ?? "",
    language: typeof runtimeConfig?.settings?.elevenlabs_language === "string" && runtimeConfig.settings.elevenlabs_language.trim()
      ? runtimeConfig.settings.elevenlabs_language.trim()
      : env.ELEVENLABS_LANGUAGE ?? "multi",
  };
}

function getLlmModelFromRuntime(runtimeConfig) {
  const runtimeModel = runtimeConfig?.settings?.dg_agent_llm_model;
  return typeof runtimeModel === "string" && runtimeModel.trim() ? runtimeModel.trim() : null;
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
  const routeLines = routes.filter((route) => route.priority < 500).map((route) => {
    const keywords = Array.isArray(route.keywords) && route.keywords.length > 0
      ? ` Mots-clés fréquents : ${route.keywords.join(", ")}.`
      : "";
    return `- ${route.serviceName} = poste ${route.extension}.${keywords}`;
  });
  const directoryLines = Array.isArray(runtimeConfig?.directoryContacts) && runtimeConfig.directoryContacts.length > 0
    ? runtimeConfig.directoryContacts.slice(0, 50).map((contact) => `- ${contact.name} = poste ${contact.extension}`)
    : [];
  const intentLines = Array.isArray(primaryFlow?.intents) && primaryFlow.intents.length > 0
    ? primaryFlow.intents.map((intent) => {
      const keywords = Array.isArray(intent.keywords) && intent.keywords.length > 0 ? intent.keywords.join(", ") : "aucun";
      return `- ${intent.label} -> poste ${intent.destinationPost}. Mots-clés : ${keywords}. Réponse courte suggérée : ${intent.response}`;
    })
    : [];

  return [
    `Tu es l'agent téléphonique IA de ${companyName}.`,
    "Tu parles à des clients au téléphone au Québec. La conversation doit être naturelle, simple, chaleureuse, très fluide et sonner humaine.",
    "Tu peux faire un vrai transfert d'appel avec la fonction \"transfert\". Quand l'intention est claire, tu dois transférer l'appel rapidement.",
    buildGreetingFromRuntime(runtimeConfig) ? `Le message d’accueil a déjà été dit au tout début de l’appel : "${buildGreetingFromRuntime(runtimeConfig)}". Ne le répète jamais après qu'un client a commencé à parler.` : "",
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
    directoryLines.length > 0 ? `Annuaire interne disponible pour transfert par nom :\n${directoryLines.join("\n")}` : "",
    "Si le client demande une personne précise de l'annuaire, considère immédiatement que la destination est claire.",
    "Exemples de demandes claires : je veux parler à Martin Carrier, transfère-moi à Martin, je voudrais joindre Martin Carrier.",
    "Quand un prénom ou un nom correspond clairement à une seule personne de l'annuaire, transfère vers cette personne sans redemander la raison de l'appel.",
    "Ne répète jamais la question d'accueil après une réponse du client. Après une réponse du client, soit tu transfères, soit tu poses une courte question de clarification différente.",
    intentLines.length > 0 ? `Intentions configurées :\n${intentLines.join("\n")}` : "",
    runtimeConfig?.prompts?.main ? `Directives supplémentaires : ${runtimeConfig.prompts.main}` : "",
    "Style de conversation : parle comme une bonne réceptionniste québécoise au téléphone, avec des phrases courtes, naturelles, professionnelles et faciles à comprendre.",
    "Utilise un français québécois naturel. Évite les formulations trop soutenues comme \"comment puis-je vous assister aujourd'hui\" et préfère \"qu'est-ce que je peux faire pour vous\".",
    "Avant chaque transfert, dis une seule phrase courte et naturelle, puis appelle immédiatement la fonction \"transfert\" avec le bon poste.",
    runtimeConfig?.prompts?.transferSupport ? `Phrase support à privilégier : "${runtimeConfig.prompts.transferSupport}"` : "",
    runtimeConfig?.prompts?.transferSales ? `Phrase ventes à privilégier : "${runtimeConfig.prompts.transferSales}"` : "",
    runtimeConfig?.prompts?.transferReception ? `Phrase réception à privilégier : "${runtimeConfig.prompts.transferReception}"` : "",
    "Une fois le transfert annoncé, n'ajoute pas une autre phrase comme \"un instant s'il vous plaît\".",
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
    this._routes = Array.isArray(options.routes) && options.routes.length > 0 ? options.routes : getRoutesFromRuntimeConfig(this.runtimeConfig);
    this.agentGreeting = options.greeting ?? (buildGreetingFromRuntime(this.runtimeConfig) || null);
    this.agentPrompt = options.prompt ?? (buildPromptFromRuntime(this.runtimeConfig, this._routes) || null);
    this.ws = null;
    this._settingsApplied = false;
    this._keepAliveId = null;
    this._outputSampleRate = 8000;
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
    const _s = this._buildSettings(); log.info({ settings: JSON.stringify(_s, null, 2) }, "Settings envoyés à Deepgram"); this.ws.send(JSON.stringify(_s));
  }

  _buildSettings() {
    const prompt = this.agentPrompt ?? env.DG_AGENT_PROMPT ?? DEFAULT_AGENT_PROMPT;
    const transferExtensions = [...new Set(this._routes.map((route) => String(route.extension).trim()).filter(Boolean))];
    const transferDescription = this._routes
      .map((route) => `${route.extension} = ${route.serviceName}`)
      .join(", ");
    const ttsProvider = getTtsProviderFromRuntime(this.runtimeConfig);
    const ttsModel = getTtsModelFromRuntime(this.runtimeConfig) ?? env.DG_TTS_MODEL ?? "aura-2-agathe-fr";
    const llmModel = getLlmModelFromRuntime(this.runtimeConfig) ?? env.DG_AGENT_LLM_MODEL ?? "gpt-4o-mini";
    const elevenLabs = getElevenLabsConfigFromRuntime(this.runtimeConfig);
    const useElevenLabs = !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID); // ElevenLabs géré séparément via REST streaming
    const speak = useElevenLabs
      ? {
          provider: {
            type: "eleven_labs",
            model_id: elevenLabs.modelId,
            language_code: "fr",
          },
          endpoint: {
            url: `wss://api.elevenlabs.io/v1/text-to-speech/${elevenLabs.voiceId}/multi-stream-input`,
            headers: {
              "xi-api-key": env.ELEVENLABS_API_KEY,
            },
          },
        }
      : {
          provider: {
            type: "deepgram",
            model: ttsModel,
          },
        };
    if (ttsProvider === "eleven_labs" && !useElevenLabs) {
      log.warn(
        "ElevenLabs demandé mais configuration incomplète (API key ou voice ID manquant dans runtime/.env), fallback vers Deepgram"
      );
    }
    const settings = {
      type: "Settings",
      audio: {
        input: {
          encoding: "mulaw",
          sample_rate: 8000,
        },
        output: {
          encoding: "mulaw",
          sample_rate: 8000,
        },
      },
      agent: {
        language: "fr",
        speak,
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
            model: llmModel,
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
                  if (data.length > 0) {
          if (!this._firstChunkLogged) {
            this._firstChunkLogged = true;
            log.info({ mulaw8k: data.length }, "Agent audio: first chunk (mulaw direct)");
          }
          this.onAgentAudio(Buffer.from(data));
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

    const ranked = this._routes
      .map((route) => ({ route, score: getRouteMatchScore(route, text) }))
      .filter((item) => item.score >= 70)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.route ?? null;
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
