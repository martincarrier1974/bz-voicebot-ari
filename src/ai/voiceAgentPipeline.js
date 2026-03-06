import { log } from "../utils/logger.js";
import { DeepgramAgent } from "./deepgramAgent.js";

/**
 * Pipeline qui utilise l'agent conversationnel Deepgram (STT + LLM + TTS).
 * Un seul flux: RTP -> Agent (audio) -> Agent (réponse audio) -> RTP.
 */
export class VoiceAgentPipeline {
  /**
   * @param {import("../media/rtpServer.js").RtpServer} rtpServer
   */
  constructor(rtpServer) {
    this.rtpServer = rtpServer;
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

  async start() {
    this.rtpServer.setActivePipeline(this);
    this.agent = new DeepgramAgent((audioMulaw) => {
      if (!this.rtpServer.remote) return;
      this.rtpServer.sendUlawStream(audioMulaw);
    });
    await this.agent.connect();
    this._ready = true;
    log.info("VoiceAgentPipeline started (Deepgram Agent)");
  }
}
