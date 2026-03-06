import dgram from "dgram";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

const RTP_HEADER_LEN = 12;
const PCMU_PT = 0;
const FRAME_BYTES = 160; // 20ms @ 8kHz mulaw
const FRAME_INTERVAL_MS = 20;

/**
 * Parse RTP header (minimal: version, payload type, seq, timestamp, SSRC).
 * Returns { payloadType, seq, timestamp, ssrc } or null if too short.
 */
function parseRtpHeader(buffer) {
  if (buffer.length < RTP_HEADER_LEN) return null;
  const payloadType = buffer[1] & 0x7f;
  const seq = buffer.readUInt16BE(2);
  const timestamp = buffer.readUInt32BE(4);
  const ssrc = buffer.readUInt32BE(8);
  return { payloadType, seq, timestamp, ssrc };
}

/**
 * RTP server: reçoit RTP (ulaw) d'Asterisk ExternalMedia, envoie à activePipeline.handleAudio;
 * envoie ulaw vers le remote (sendUlawStream) avec queue et stopPlayback.
 */
export class RtpServer {
  constructor() {
    this.sock = dgram.createSocket("udp4");
    this.remote = null;
    /** Pipeline actif pour cet appel (audio routé vers lui). */
    this.activePipeline = null;
    this._playQueue = [];
    this._playIntervalId = null;
    this._seq = 0;
    this._timestamp = 0;
    this._ssrc = (Math.random() * 0xffffffff) >>> 0;
    this._packetCount = 0;
    this._byteCount = 0;
    this._sentFirstPacket = false;
  }

  /**
   * Définit le pipeline actif (un appel = un pipeline). Les paquets RTP sont envoyés à ce pipeline.
   * @param {{ handleAudio(payload: Buffer): void } | null} pipeline
   */
  setActivePipeline(pipeline) {
    if (this.activePipeline && this.activePipeline !== pipeline && typeof this.activePipeline.close === "function") {
      this.activePipeline.close();
    }
    this.activePipeline = pipeline;
  }

  /**
   * Réinitialise l'état RTP entre deux appels.
   * Sans ça, le 2e appel peut réutiliser l'ancien remote/SSRC/queue et perdre le message d'accueil.
   */
  resetSession() {
    this.stopPlayback();
    this.remote = null;
    this.activePipeline = null;
    this._seq = 0;
    this._timestamp = 0;
    this._ssrc = (Math.random() * 0xffffffff) >>> 0;
    this._sentFirstPacket = false;
  }

  setRemote(rinfo) {
    this.remote = { address: rinfo.address, port: rinfo.port };
    log.info({ remote: this.remote }, "RTP remote learned");
  }

  start() {
    this.sock.on("message", (msg, rinfo) => {
      if (!this.remote) this.setRemote(rinfo);

      if (msg.length < RTP_HEADER_LEN) return;
      const header = parseRtpHeader(msg);
      if (!header) return;

      this._packetCount += 1;
      this._byteCount += msg.length - RTP_HEADER_LEN;

      const payload = msg.subarray(RTP_HEADER_LEN);
      if (payload.length > 0 && this.activePipeline?.handleAudio) this.activePipeline.handleAudio(payload);
    });

    this.sock.bind(env.RTP_LISTEN_PORT, env.RTP_LISTEN_IP, () => {
      log.info({ ip: env.RTP_LISTEN_IP, port: env.RTP_LISTEN_PORT }, "RTP server listening");
    });
  }

  /**
   * Envoyer un flux ulaw en frames de 160 bytes (20ms) à 8kHz, PT=0 (PCMU).
   * Découpe buffer en frames, met en queue, envoie à 20ms d'intervalle.
   * Les trames incomplètes sont complétées avec du silence (0xff = mulaw silence).
   */
  sendUlawStream(buffer) {
    if (!buffer || buffer.length === 0) return;
    for (let i = 0; i < buffer.length; i += FRAME_BYTES) {
      let chunk = buffer.subarray(i, Math.min(i + FRAME_BYTES, buffer.length));
      if (chunk.length < FRAME_BYTES) {
        const padded = Buffer.alloc(FRAME_BYTES, 0xff);
        chunk.copy(padded);
        chunk = padded;
      }
      this._playQueue.push(Buffer.from(chunk));
    }
    this._startPlaybackIfNeeded();
  }

  _startPlaybackIfNeeded() {
    if (this._playIntervalId != null) return;
    this._playIntervalId = setInterval(() => this._sendNextFrame(), FRAME_INTERVAL_MS);
  }

  _sendNextFrame() {
    if (this._playQueue.length === 0) {
      clearInterval(this._playIntervalId);
      this._playIntervalId = null;
      return;
    }
    const frame = this._playQueue.shift();
    if (!this.remote) return;
    if (!this._sentFirstPacket) {
      this._sentFirstPacket = true;
      log.info({ to: this.remote }, "RTP first packet sent to Asterisk (voix retour)");
    }
    const header = Buffer.alloc(RTP_HEADER_LEN);
    header[0] = 0x80;
    header[1] = PCMU_PT;
    header.writeUInt16BE(this._seq++ & 0xffff, 2);
    header.writeUInt32BE(this._timestamp & 0xffffffff, 4);
    this._timestamp += frame.length;
    header.writeUInt32BE(this._ssrc, 8);
    const packet = Buffer.concat([header, frame]);
    this.sock.send(packet, this.remote.port, this.remote.address);
  }

  stopPlayback() {
    this._playQueue = [];
    if (this._playIntervalId != null) {
      clearInterval(this._playIntervalId);
      this._playIntervalId = null;
    }
  }

  getStats() {
    return { packetCount: this._packetCount, byteCount: this._byteCount };
  }
}
