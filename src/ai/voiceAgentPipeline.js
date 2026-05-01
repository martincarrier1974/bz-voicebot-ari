import axios from "axios";
import { env } from "../config/env.js";
import { createInitialCallRuntimeState } from "../runtime/callRuntime.js";
import { removeLiveCall, upsertLiveCall } from "../runtime/liveCallsRegistry.js";
import { log } from "../utils/logger.js";
import { suggestGoogleSlots, resolveBookingTargets } from "../calendar/booking.js";
import { createEvent } from "../calendar/google.js";
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


function getPrimaryFlow(runtimeConfig) {
  return Array.isArray(runtimeConfig?.flows) && runtimeConfig.flows.length > 0 ? runtimeConfig.flows[0] : null;
}


function getBookingServices(runtimeConfig) {
  return Array.isArray(runtimeConfig?.bookingServices) ? runtimeConfig.bookingServices : [];
}

function normalizeBookingToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function resolveServiceSlug(runtimeConfig, input) {
  const services = getBookingServices(runtimeConfig);
  const needle = normalizeBookingToken(input);
  if (!needle) return null;
  const exact = services.find((service) => normalizeBookingToken(service.slug) === needle);
  if (exact) return exact.slug;
  const byName = services.find((service) => normalizeBookingToken(service.name) === needle || normalizeBookingToken(service.name).includes(needle));
  return byName?.slug ?? null;
}

function formatSlotTime(date, timeZone = "America/Toronto") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function formatSlotDate(date, timeZone = "America/Toronto") {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function parseRequestedDay(input) {
  const raw = String(input || "").trim();
  if (!raw) return new Date();

  const isoDateOnly = /^((\d{4})-(\d{2})-(\d{2}))$/.exec(raw);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[2]);
    const month = Number(isoDateOnly[3]);
    const day = Number(isoDateOnly[4]);
    const now = new Date();
    const currentYear = now.getFullYear();

    if (year < currentYear) {
      let candidate = new Date(`${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (candidate < todayStart) {
        candidate = new Date(`${currentYear + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
      }
      log.warn({ raw, correctedTo: candidate.toISOString() }, "Booking date auto-corrected to upcoming year");
      return candidate;
    }

    return new Date(`${raw}T00:00:00`);
  }

  return new Date(raw);
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

    const ranked = this._routes
      .map((route) => ({ route, score: getRouteMatchScore(route, text) }))
      .filter((item) => item.score >= 70)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.route ?? null;
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

  async _checkAvailability(args = {}) {
    const serviceSlug = resolveServiceSlug(this._runtimeConfig, args.serviceSlug || args.service || args.prestation || args.typeService);
    if (!serviceSlug) {
      const available = getBookingServices(this._runtimeConfig).map((service) => `${service.name} (${service.slug})`).join(", ");
      return `Service introuvable. Services disponibles: ${available || "aucun"}.`;
    }

    const day = parseRequestedDay(args.date || args.day);
    if (Number.isNaN(day.getTime())) {
      return "Date invalide. Utilise le format YYYY-MM-DD.";
    }

    const result = await suggestGoogleSlots({
      runtimeConfig: this._runtimeConfig,
      serviceSlug,
      preferredEmployeeName: args.employeeName || args.employee || args.employe || null,
      day,
    });

    if (!result?.service) {
      return `Service ${serviceSlug} introuvable.`;
    }

    const first = result.suggestions?.[0];
    const slots = first?.slots || [];
    if (slots.length === 0) {
      return `Aucune disponibilité trouvée pour ${result.service.name}. Raison: ${result.reason || "indisponible"}.`;
    }

    const timeZone = "America/Toronto";
    const dateLabel = formatSlotDate(slots[0].start, timeZone);
    const times = slots.map((slot) => formatSlotTime(slot.start, timeZone));
    const employeeName = first.employeeName || first.resourceName;
    return `Disponibilités pour ${result.service.name} le ${dateLabel} avec ${employeeName}: ${times.join(", ")}. Pour réserver, utilise creer_rendez_vous avec serviceSlug="${result.service.slug}", date="${dateLabel}" et time parmi ${times.join(", ")}.`;
  }

  async _createBooking(args = {}) {
    const serviceSlug = resolveServiceSlug(this._runtimeConfig, args.serviceSlug || args.service || args.prestation || args.typeService);
    if (!serviceSlug) {
      const available = getBookingServices(this._runtimeConfig).map((service) => `${service.name} (${service.slug})`).join(", ");
      return `Service introuvable. Services disponibles: ${available || "aucun"}.`;
    }

    const requestedTime = String(args.time || args.heure || "").trim();
    if (!/^\d{2}:\d{2}$/.test(requestedTime)) {
      return "Heure invalide. Utilise le format HH:MM, par exemple 15:30.";
    }

    const day = parseRequestedDay(args.date || args.day);
    if (Number.isNaN(day.getTime())) {
      return "Date invalide. Utilise le format YYYY-MM-DD.";
    }

    const preferredEmployeeName = args.employeeName || args.employee || args.employe || null;
    const result = await suggestGoogleSlots({
      runtimeConfig: this._runtimeConfig,
      serviceSlug,
      preferredEmployeeName,
      day,
      maxSlotsPerEmployee: 20,
    });

    if (!result?.service) {
      return `Service ${serviceSlug} introuvable.`;
    }

    const first = result.suggestions?.[0];
    const matchingSlot = (first?.slots || []).find((slot) => formatSlotTime(slot.start, "America/Toronto") == requestedTime);
    if (!first || !matchingSlot) {
      return `Le créneau ${requestedTime} n'est pas disponible pour ${result.service.name}.`;
    }

    const targets = resolveBookingTargets(this._runtimeConfig, serviceSlug, preferredEmployeeName);
    const target = targets.targets.find((item) => item.calendarId === first.calendarId) || targets.targets[0];
    if (!target?.connection) {
      return "Connexion calendrier introuvable pour cette réservation.";
    }

    const customerName = String(args.customerName || args.nomClient || args.nom || "Client téléphone").trim();
    const customerPhone = String(args.customerPhone || args.telephone || args.phone || "").trim();
    const notes = String(args.notes || args.note || "").trim();
    const description = [
      `Réservation créée par le voicebot.`,
      `Service: ${result.service.name}`,
      customerName ? `Client: ${customerName}` : "",
      customerPhone ? `Téléphone: ${customerPhone}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const event = await createEvent({
      connection: target.connection,
      calendarId: first.calendarId,
      summary: `${result.service.name} - ${customerName}`,
      description,
      startISO: matchingSlot.start,
      endISO: matchingSlot.end,
      timeZone: target.resource.timezone || target.connection.timezone || "America/Toronto",
    });

    const dateLabel = formatSlotDate(matchingSlot.start, "America/Toronto");
    return `Rendez-vous confirmé pour ${result.service.name} le ${dateLabel} à ${requestedTime}. ID événement: ${event.id}.`;
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
    const onCheckAvailability = (args) => this._checkAvailability(args);
    const onCreateBooking = (args) => this._createBooking(args);
    this.agent = new DeepgramAgent(
      (audioMulaw) => {
        this.rtpServer.sendUlawStream(audioMulaw);
      },
      {
        onTransfer: onTransfer ?? undefined,
        onCheckAvailability,
        onCreateBooking,
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
