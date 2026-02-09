import dgram from "dgram";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

/**
 * MVP skeleton:
 * - receives RTP packets from Asterisk ExternalMedia
 * - TODO: parse RTP header, extract PCM payload
 * - TODO: forward payload to Voice AI streaming
 * - TODO: send synthesized audio back as RTP
 */
export class RtpServer {
  constructor() {
    this.sock = dgram.createSocket("udp4");
    this.remote = null; // { address, port } to send RTP back (learned from first packet)
  }

  start() {
    this.sock.on("message", (msg, rinfo) => {
      if (!this.remote) {
        this.remote = { address: rinfo.address, port: rinfo.port };
        log.info({ remote: this.remote }, "RTP remote learned");
      }
      // TODO: Parse RTP (12-byte header) + payload
      // For now, just log packet size.
      log.debug({ bytes: msg.length }, "RTP packet");
    });

    this.sock.bind(env.RTP_LISTEN_PORT, env.RTP_LISTEN_IP, () => {
      log.info({ ip: env.RTP_LISTEN_IP, port: env.RTP_LISTEN_PORT }, "RTP server listening");
    });
  }

  sendRtpPacket(packet) {
    if (!this.remote) return;
    this.sock.send(packet, this.remote.port, this.remote.address);
  }
}
