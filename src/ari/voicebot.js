import ari from "ari-client";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { RtpServer } from "../media/rtpServer.js";

/**
 * This sets up:
 * - Answer call
 * - Create mixing bridge
 * - Create ExternalMedia channel (RTP) to our media server
 * - Add caller + externalMedia into the bridge
 */
/** Channel IDs we create (ExternalMedia). Ignore their StasisStart to avoid re-running call logic. */
const ourExternalMediaIds = new Set();

export async function startVoicebot() {
  const rtp = new RtpServer();
  rtp.start();

  ari.connect(env.ARI_URL, env.ARI_USER, env.ARI_PASS, (err, client) => {
    if (err) throw err;

    client.on("StasisStart", async (event, channel) => {
      const chanId = channel.id;
      log.info({ chanId, caller: channel.caller }, "StasisStart");

      if (ourExternalMediaIds.has(chanId)) {
        ourExternalMediaIds.delete(chanId);
        log.debug({ chanId }, "StasisStart for our ExternalMedia channel, skip");
        return;
      }

      try {
        await channel.answer();

        const bridge = await client.bridges.create({ type: "mixing", name: `vb_${chanId}` });
        await bridge.addChannel({ channel: chanId });

        // Create external media channel pointing to our RTP server.
        // external_host should be IP:PORT reachable by Asterisk (your server IP).
        const externalHost = `${env.ASTERISK_PUBLIC_IP}:${env.RTP_LISTEN_PORT}`;

        const ext = await client.channels.externalMedia({
          app: env.ARI_APP,
          external_host: externalHost,
          format: env.RTP_FORMAT, // slin16 typical
        });
        ourExternalMediaIds.add(ext.id);

        log.info({ extId: ext.id, extState: ext.state }, "ExternalMedia created");

        await bridge.addChannel({ channel: ext.id });

        log.info({ bridge: bridge.id, extMedia: ext.id, externalHost }, "Bridge + ExternalMedia ready");

        // TODO: hook media server <-> Voice AI realtime and start conversation

      } catch (e) {
        log.error({ err: e, chanId }, "Error in call handling");
        try { await channel.hangup(); } catch {}
      }
    });

    client.start(env.ARI_APP);
    log.info("ARI Voicebot started");
  });
}
