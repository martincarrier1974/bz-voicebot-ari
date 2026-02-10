import ari from "ari-client";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { RtpServer } from "../media/rtpServer.js";
import { VoicePipeline } from "../ai/voicePipeline.js";

/**
 * This sets up:
 * - Answer call
 * - Create mixing bridge
 * - Create ExternalMedia channel (RTP) to our media server
 * - Add caller + externalMedia into the bridge
 */
/** Channel IDs we create (ExternalMedia). Ignore their StasisStart to avoid re-running call logic. */
const ourExternalMediaIds = new Set();

/**
 * Joue un son/tone sur le canal et attend la fin (ou timeout).
 * @param {object} client - client ARI
 * @param {object} channel - canal ARI
 * @param {string} media - URI (ex: "sound:beep" ou "tone:ring;tonezone=fr")
 */
function playToneAndWait(client, channel, media) {
  return new Promise((resolve, reject) => {
    const playback = client.Playback();
    const timeout = setTimeout(() => {
      playback.removeAllListeners?.();
      resolve();
    }, 3000);

    playback.on("PlaybackFinished", () => {
      clearTimeout(timeout);
      resolve();
    });
    playback.on("PlaybackFailed", () => {
      clearTimeout(timeout);
      reject(new Error("PlaybackFailed"));
    });

    channel.play({ media }, playback, (err) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

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
      // Canal créé par nous (ExternalMedia) : nom typique "ExternalMedia/..."
      if (channel.name && String(channel.name).toLowerCase().startsWith("externalmedia/")) {
        log.debug({ chanId, name: channel.name }, "StasisStart for ExternalMedia channel, skip");
        return;
      }

      try {
        await channel.answer();

        // Jouer un tone (beep) pour confirmer la prise d'appel
        const welcomeTone = env.WELCOME_TONE ?? "sound:beep";
        try {
          await playToneAndWait(client, channel, welcomeTone);
        } catch (toneErr) {
          log.warn({ err: toneErr, chanId }, "Welcome tone failed, continuing without");
        }

        const bridge = await client.bridges.create({ type: "mixing", name: `vb_${chanId}` });
        await bridge.addChannel({ channel: chanId });

        // Create external media channel pointing to our RTP server.
        const mediaHost = env.MEDIA_SERVER_IP ?? env.ASTERISK_PUBLIC_IP;
        const externalHost = `${mediaHost}:${env.RTP_LISTEN_PORT}`;

        const ext = await client.channels.externalMedia({
          app: env.ARI_APP,
          external_host: externalHost,
          format: "ulaw",
        });
        ourExternalMediaIds.add(ext.id);

        log.info({ extId: ext.id, extState: ext.state }, "ExternalMedia created");

        await bridge.addChannel({ channel: ext.id });

        log.info({ bridge: bridge.id, extMedia: ext.id, externalHost }, "Bridge + ExternalMedia ready");

        if (env.DEEPGRAM_API_KEY) {
          const pipeline = new VoicePipeline(rtp);
          pipeline.start().catch((e) => log.error({ err: e, chanId }, "VoicePipeline error"));
        } else {
          log.warn("DEEPGRAM_API_KEY not set, voice pipeline disabled");
        }

      } catch (e) {
        log.error({ err: e, chanId }, "Error in call handling");
        try { await channel.hangup(); } catch { /* ignore hangup errors */ }
      }
    });

    client.start(env.ARI_APP);
    log.info("ARI Voicebot started");
  });
}
