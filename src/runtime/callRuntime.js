import crypto from "node:crypto";

/**
 * @typedef {Object} CallRuntimeState
 * @property {{ callId: string, sessionId: string, startedAt: number, updatedAt: number, language: string, businessName: string }} session
 * @property {{ isListening: boolean, isSpeaking: boolean, isMuted: boolean, bargeInEnabled: boolean, silenceCount: number }} audio
 * @property {{ currentIntent: string, confidence: number, extractedEntities: Record<string, unknown>, needsClarification: boolean }} nlu
 * @property {{ currentStep: string, retryCount: number, maxRetries: number, transferTarget: string }} flow
 * @property {Array<Record<string, unknown>>} history
 * @property {{ handoffRequested: boolean, transferLocked: boolean, callEnded: boolean, debugMode: boolean }} flags
 * @property {Record<string, unknown>} metadata
 */

/**
 * État volatile d'un appel en cours.
 * La configuration publiée par l'admin doit rester séparée de cet objet.
 *
 * @param {{
 *   callId?: string;
 *   sessionId?: string;
 *   businessName?: string;
 *   language?: string;
 *   maxRetries?: number;
 *   debugMode?: boolean;
 * }} [input]
 * @returns {CallRuntimeState}
 */
export function createInitialCallRuntimeState(input = {}) {
  return {
    session: {
      callId: input.callId ?? crypto.randomUUID(),
      sessionId: input.sessionId ?? crypto.randomUUID(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      language: input.language ?? "fr",
      businessName: input.businessName ?? "BZ Telecom",
    },
    audio: {
      isListening: false,
      isSpeaking: false,
      isMuted: false,
      bargeInEnabled: true,
      silenceCount: 0,
    },
    nlu: {
      currentIntent: "unknown",
      confidence: 0,
      extractedEntities: {},
      needsClarification: false,
    },
    flow: {
      currentStep: "welcome",
      retryCount: 0,
      maxRetries: input.maxRetries ?? 2,
      transferTarget: "NONE",
    },
    history: [],
    flags: {
      handoffRequested: false,
      transferLocked: false,
      callEnded: false,
      debugMode: input.debugMode ?? false,
    },
    metadata: {},
  };
}
