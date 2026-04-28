import axios from "axios";
import { env } from "../config/env.js";
import { createInitialCallRuntimeState } from "../runtime/callRuntime.js";
import { removeLiveCall, upsertLiveCall } from "../runtime/liveCallsRegistry.js";
import { log } from "../utils/logger.js";
import { DeepgramAgent } from "./deepgramAgent.js";

/** Routes de transfert configurables. */
const TRANSFER_ENV_KEYS = { "101": "TRANSFER_POSTE_101", "102": "TRANSFER_POSTE_102", "105": "TRANSFER_POSTE_105" };

function getDefaultRoutes() {
  return [
    { serviceName: "Soutien technique", extension: "101", keywords: ["support", "soutien", "technique"], priority: 10 },
    { serviceName: "Ventes et soumissions", extension: "102", keywords: ["vente", "soumission", "prix"], priority: 20 },
    { serviceName: "Réception", extension: "105", keywords: ["réception", "autre", "général"], priority: 30 },
  ];
}

function getDirectoryRoutesFromRuntimeConfig(runtimeConfig) {
  const contacts = Array.isArray(runtimeConfig?.directoryContacts) ? runtimeConfig.directoryContacts : [];
  return contacts
    .filter((contact) => contact?.extension && contact?.name)
    .map((contact) => ({
      serviceName: String(contact.name).trim(),
      extension: String(contact.extension).trim(),
      keywords: [...new Set([contact.name, ...(Array.isArray(contact.aliases) ? contact.aliases : [])].map((item) => String(item || "").trim()).filter(Boolean))],
      priority: 500,
    }));
}

function getRoutesFromRuntimeConfig(runtimeConfig) {
  const routes = Array.isArray(runtimeConfig?.routes) ? runtimeConfig.routes : [];
  const baseRoutes = routes.length > 0 ? routes : getDefaultRoutes();
  const normalized = baseRoutes
    .filter((route) => route?.extension)
    .map((route) => ({
      serviceName: String(route.serviceName || `Poste ${route.extension}`).trim(),
      extension: String(route.extension).trim(),
      keywords: Array.isArray(route.keywords)
        ? route.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
        : [],
      priority: Number(route.priority || 999),
    }))
    .sort((a, b) => a.priority - b.priority);

  return [...normalized, ...getDirectoryRoutesFromRuntimeConfig(runtimeConfig)];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getPrimaryFlow(runtimeConfig) {
  return Array.isArray(runtimeConfig?.flows) && runtimeConfig.flows.length > 0 ? runtimeConfig.flows[0] : null;
}

/**
 * Pipeline qui utilise l'agent conversationnel Deepgram (STT + LLM + TTS).
 * Optionnel: channelId + ariBase + ariAuth pour transfert ARI réel.
 */
export class VoiceAgentPipeline {
  /**
   * @param {import("../media/rtpServer.js").RtpServer} rtpServer
   * @param {{ channelId?: string; ariBase?: string; ariAuth?: { username: string; password: string } }} [options] - pour transfert ARI
   */
  constructor(rtpServer, options = {}) {
    this.rtpServer = rtpServer;
    this._channelId = options.channelId ?? null;
    this._ariBase = options.ariBase ?? null;
    this._ariAuth = options.ariAuth ?? null;
    this._runtimeConfig = options.runtimeConfig ?? null;
    this._routes = getRoutesFromRuntimeConfig(this._runtimeConfig);
    const primaryFlow = getPrimaryFlow(this._runtimeConfig);
    this.runtimeState = createInitialCallRuntimeState({
      callId: this._channelId ?? undefined,
      businessName: this._runtimeConfig?.companyName ?? "BZ Telecom",
      language: "fr",
      maxRetries: primaryFlow?.maxFailedAttempts ?? 2,
      debugMode: true,
    });
    this.runtimeState.metadata = {
      channelId: this._channelId,
      runtimeConfigVersion: this._runtimeConfig?.version ?? null,
      runtimeConfigGeneratedAt: this._runtimeConfig?.generatedAt ?? null,
      activeFlowName: primaryFlow?.name ?? null,
      routeCount: this._routes.length,
    };
    this.agent = null;
    this._ready = false;
  }

  _syncRuntimeState() {
    upsertLiveCall(this.getRuntimeState());
  }

  /**
   * Appelé par RtpServer pour chaque paquet audio (pipeline actif).
   * @param {Buffer} payloadBytes
   */
  handleAudio(payloadBytes) {
    if (this.agent && this._ready && payloadBytes?.length) {
      this.runtimeState.audio.isListening = true;
      this.runtimeState.session.updatedAt = Date.now();
      this._syncRuntimeState();
      this.agent.sendAudio(payloadBytes);
    }
  }

  async _doTransfer(poste) {
    if (!this._channelId || !this._ariBase || !this._ariAuth) {
      throw new Error("Transfert non configuré (channelId/ARI manquants)");
    }
    const matchedRoute = this._routes.find((route) => route.extension === String(poste).trim());
    this.runtimeState.flags.handoffRequested = true;
    this.runtimeState.flags.transferLocked = true;
    this.runtimeState.flow.transferTarget = String(poste).trim();
    this.runtimeState.flow.currentStep = "transfer";
    this.runtimeState.session.updatedAt = Date.now();
    this._syncRuntimeState();
    const envKey = TRANSFER_ENV_KEYS[poste];
    const route = (envKey && env[envKey]) ? env[envKey] : `dialplan:from-internal,${poste},1`;

    // FreePBX/Asterisk interne: on renvoie le canal dans le dialplan.
    if (route.startsWith("dialplan:")) {
      const [, target = "from-internal,105,1"] = route.split(":", 2);
      const [context = "from-internal", extension = poste, priority = "1"] = target.split(",");
      await axios.post(
        `${this._ariBase}/channels/${this._channelId}/continue`,
        null,
        {
          params: { context, extension, priority },
          auth: this._ariAuth,
        }
      );
      log.info(
        { channelId: this._channelId, poste, context, extension, priority, serviceName: matchedRoute?.serviceName },
        "Transfert ARI effectué (continue)"
      );
      this.runtimeState.metadata.transferMode = "continue";
      this.runtimeState.metadata.transferServiceName = matchedRoute?.serviceName ?? null;
      this.runtimeState.metadata.transferCompletedAt = Date.now();
      this._syncRuntimeState();
      return `Transfert effectué au poste ${poste}.`;
    }

    // Fallback: redirect vers un endpoint explicite PJSIP/..., Local/... etc.
    await axios.post(
      `${this._ariBase}/channels/${this._channelId}/redirect`,
      null,
      {
        params: { endpoint: route },
        auth: this._ariAuth,
      }
    );
    log.info({ channelId: this._channelId, poste, endpoint: route, serviceName: matchedRoute?.serviceName }, "Transfert ARI effectué (redirect)");
    this.runtimeState.metadata.transferMode = "redirect";
    this.runtimeState.metadata.transferServiceName = matchedRoute?.serviceName ?? null;
    this.runtimeState.metadata.transferCompletedAt = Date.now();
    this._syncRuntimeState();
    return `Transfert effectué au poste ${poste}.`;
  }

  _recordConversation(role, text) {
    if (typeof text !== "string" || !text.trim()) return;
    this.runtimeState.history.push({
      role,
      text,
      timestamp: Date.now(),
    });
    if (this.runtimeState.history.length > 20) {
      this.runtimeState.history = this.runtimeState.history.slice(-20);
    }
    this.runtimeState.session.updatedAt = Date.now();
    this._syncRuntimeState();
  }

  _matchRouteFromText(text) {
    const normalizedText = normalizeText(text);
    if (!normalizedText) return null;

    return this._routes.find((route) => {
      if (normalizedText.includes(normalizeText(route.serviceName))) return true;
      if (normalizedText.includes(`poste ${normalizeText(route.extension)}`)) return true;
      return Array.isArray(route.keywords) && route.keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)));
    }) ?? null;
  }

  _updateIntentFromUserText(text) {
    const route = this._matchRouteFromText(text);
    this.runtimeState.flow.currentStep = "user_input";
    this.runtimeState.nlu.currentIntent = route ? normalizeText(route.serviceName) : "unknown";
    this.runtimeState.nlu.confidence = route ? 0.8 : 0;
    this.runtimeState.nlu.needsClarification = !route;

    if (!route) {
      this.runtimeState.flow.retryCount += 1;
      this.runtimeState.audio.silenceCount = 0;
      if (this.runtimeState.flow.retryCount >= this.runtimeState.flow.maxRetries) {
        this.runtimeState.flow.transferTarget = "105";
      }
    } else {
      this.runtimeState.flow.retryCount = 0;
      this.runtimeState.flow.transferTarget = route.extension;
    }
  }

  _updateStateFromAgentText(text) {
    const normalizedText = normalizeText(text);
    this.runtimeState.flow.currentStep = "agent_response";

    if (normalizedText.includes("je vous transf")) {
      const route = this._matchRouteFromText(text);
      if (route) {
        this.runtimeState.flags.handoffRequested = true;
        this.runtimeState.flow.transferTarget = route.extension;
      }
      this.runtimeState.nlu.needsClarification = false;
      return;
    }

    if (
      normalizedText.includes("quelle est la raison de votre appel") ||
      normalizedText.includes("est-ce pour") ||
      normalizedText.includes("je peux vous aider a diriger votre appel")
    ) {
      this.runtimeState.nlu.needsClarification = true;
      this.runtimeState.flow.currentStep = "clarification";
      return;
    }

    if (normalizedText.includes("reception") || normalizedText.includes("réception")) {
      this.runtimeState.flow.transferTarget = "105";
    }
  }

  _handleAgentEvent(event) {
    if (!event || typeof event !== "object") return;

    if (event.type === "agent_audio_start") {
      this.runtimeState.audio.isSpeaking = true;
      this.runtimeState.audio.isListening = false;
      this.runtimeState.flow.currentStep = "agent_speaking";
      this.runtimeState.session.updatedAt = Date.now();
      this._syncRuntimeState();
      return;
    }

    if (event.type === "agent_audio_done") {
      this.runtimeState.audio.isSpeaking = false;
      this.runtimeState.audio.isListening = true;
      this.runtimeState.session.updatedAt = Date.now();
      this._syncRuntimeState();
      return;
    }

    if (event.type === "conversation_text") {
      this._recordConversation(event.role, event.text);
      if (event.role === "user") this._updateIntentFromUserText(event.text);
      if (event.role === "assistant") this._updateStateFromAgentText(event.text);
      return;
    }

    if (event.type === "transfer_requested") {
      this.runtimeState.flags.handoffRequested = true;
      this.runtimeState.flags.transferLocked = true;
      this.runtimeState.flow.currentStep = "transfer_requested";
      this.runtimeState.flow.transferTarget = event.poste ?? this.runtimeState.flow.transferTarget;
      this.runtimeState.metadata.transferRequestedAt = Date.now();
      this.runtimeState.session.updatedAt = Date.now();
      this._syncRuntimeState();
    }
  }

  getRuntimeState() {
    return structuredClone(this.runtimeState);
  }

  async start() {
    this.rtpServer.setActivePipeline(this);
    const onTransfer = this._channelId && this._ariBase && this._ariAuth
      ? (poste) => this._doTransfer(poste)
      : null;
    this.agent = new DeepgramAgent(
      (audioMulaw) => {
        if (!this.rtpServer.remote) return;
        this.rtpServer.sendUlawStream(audioMulaw);
      },
      {
        onTransfer: onTransfer ?? undefined,
        runtimeConfig: this._runtimeConfig,
        routes: this._routes,
        onEvent: (event) => this._handleAgentEvent(event),
      }
    );
    await this.agent.connect();
    this._ready = true;
    this.runtimeState.flow.currentStep = "ready";
    this.runtimeState.audio.isListening = true;
    this.runtimeState.session.updatedAt = Date.now();
    this._syncRuntimeState();
    log.info("VoiceAgentPipeline started (Deepgram Agent)", onTransfer ? { transfert: true } : {});
  }

  close() {
    this._ready = false;
    this.runtimeState.flags.callEnded = true;
    this.runtimeState.audio.isListening = false;
    this.runtimeState.audio.isSpeaking = false;
    this.runtimeState.session.updatedAt = Date.now();
    this.agent?.close?.();
    removeLiveCall(this.runtimeState.session.callId);
  }
}
