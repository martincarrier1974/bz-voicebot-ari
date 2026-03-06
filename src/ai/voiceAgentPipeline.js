import axios from "axios";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { DeepgramAgent } from "./deepgramAgent.js";

/** Routes de transfert configurables. */
const TRANSFER_ENV_KEYS = { "101": "TRANSFER_POSTE_101", "102": "TRANSFER_POSTE_102", "105": "TRANSFER_POSTE_105" };

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
    this.agent = null;
    this._ready = false;
  }

  /**
   * Appelé par RtpServer pour chaque paquet audio (pipeline actif).
   * @param {Buffer} payloadBytes
   */
  handleAudio(payloadBytes) {
    if (this.agent && this._ready && payloadBytes?.length) {
      this.agent.sendAudio(payloadBytes);
    }
  }

  async _doTransfer(poste) {
    if (!this._channelId || !this._ariBase || !this._ariAuth) {
      throw new Error("Transfert non configuré (channelId/ARI manquants)");
    }
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
      log.info({ channelId: this._channelId, poste, context, extension, priority }, "Transfert ARI effectué (continue)");
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
    log.info({ channelId: this._channelId, poste, endpoint: route }, "Transfert ARI effectué (redirect)");
    return `Transfert effectué au poste ${poste}.`;
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
      onTransfer ? { onTransfer } : {}
    );
    await this.agent.connect();
    this._ready = true;
    log.info("VoiceAgentPipeline started (Deepgram Agent)", onTransfer ? { transfert: true } : {});
  }

  close() {
    this._ready = false;
    this.agent?.close?.();
  }
}
