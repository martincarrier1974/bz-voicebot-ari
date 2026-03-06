import { log } from "../utils/logger.js";
import { DeepgramStt } from "./deepgramStt.js";
import { DeepgramTts } from "./deepgramTts.js";

/**
 * Réponse texte simple selon le contenu (règle métier).
 */
function getResponseForText(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("rendez") || t.includes("rdv")) {
    return "Parfait. Dites-moi quelle journée et quelle heure vous convient.";
  }
  return `J'ai bien compris: ${text}. Voulez-vous un rendez-vous?`;
}

/** Mulaw silence = 0xff. On ne déclenche barge-in que si l'audio a de l'énergie (voix). */
const MULAW_SILENCE = 0xff;
const BARGE_IN_VOICE_RATIO = 0.05; // au moins 5 % d'échantillons non-silence

function hasVoice(payload) {
  if (!payload?.length) return false;
  let nonSilence = 0;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] !== MULAW_SILENCE) nonSilence++;
  }
  return nonSilence / payload.length >= BARGE_IN_VOICE_RATIO;
}

/**
 * Pipeline: RTP <-> Deepgram STT -> règle -> Deepgram TTS -> RTP.
 * Barge-in: on arrête le playback seulement si l'utilisateur parle (pas sur le silence).
 */
export class VoicePipeline {
  /**
   * @param {import("../media/rtpServer.js").RtpServer} rtpServer
   */
  constructor(rtpServer) {
    this.rtpServer = rtpServer;
    this.stt = new DeepgramStt();
    this.tts = new DeepgramTts();
    this._playing = false;
    this._bargeInRequested = false;
    this._greetingPlayed = false;
    /** Barge-in activé seulement après que le premier TTS (bienvenue) ait été joué. */
    this._bargeInAllowed = false;
  }

  async start() {
    this.rtpServer.onAudio((payloadBytes) => {
      if (!this._greetingPlayed && this.rtpServer.remote) {
        this._greetingPlayed = true;
        this._playResponse("Bonjour. Dites-moi comment je peux vous aider.");
      }
      if (this._playing && this._bargeInAllowed && hasVoice(payloadBytes)) {
        this._bargeInRequested = true;
        this.rtpServer.stopPlayback();
        this._playing = false;
      }
      this.stt.sendAudio(payloadBytes);
    });

    this.stt.onFinal((text) => {
      log.info({ text }, "STT final");
      const response = getResponseForText(text);
      this._playResponse(response);
    });

    try {
      await this.stt.start();
    } catch (e) {
      log.error({ err: e }, "VoicePipeline: STT start failed");
      throw e;
    }

    log.info("VoicePipeline started");
  }

  async _playResponse(responseText) {
    this._playing = true;
    this._bargeInRequested = false;
    try {
      const audioMulaw = await this.tts.speak(responseText);
      if (this._bargeInRequested) return;
      if (!this.rtpServer.remote) {
        log.warn("Cannot play TTS: RTP remote not set (aucun paquet RTP reçu d'Asterisk)");
        return;
      }
      log.info({ bytes: audioMulaw.length, response: responseText.slice(0, 50) }, "Playing TTS to RTP");
      this.rtpServer.sendUlawStream(audioMulaw);
      const stats = this.rtpServer.getStats();
      log.info(stats, "RTP stats after play");
    } catch (e) {
      log.error({ err: e }, "TTS speak failed");
    } finally {
      this._playing = false;
      this._bargeInAllowed = true;
    }
  }
}
