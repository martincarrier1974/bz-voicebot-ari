import ari from "ari-client";
import axios from "axios";
import { env } from "../config/env.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { log } from "../utils/logger.js";
import { RtpServer } from "../media/rtpServer.js";
import { VoicePipeline } from "../ai/voicePipeline.js";
import { VoiceAgentPipeline } from "../ai/voiceAgentPipeline.js";

const ariBase = env.ARI_URL.replace(/\/$/, "") + (env.ARI_URL.includes("/ari") ? "" : "/ari");
const ariAuth = { username: env.ARI_USER, password: env.ARI_PASS };

/**
 * This sets up:
 * - Answer call
 * - Create mixing bridge
 * - Create ExternalMedia channel (RTP) to our media server
 * - Add caller + externalMedia into the bridge
 */
/** Channel IDs we create (ExternalMedia). Ignore their StasisStart to avoid re-running call logic. */
const ourExternalMediaIds = new Set();
/** Quand on crée ExternalMedia via REST, on attend son StasisStart pour l'ajouter au bridge (évite 422). */
const pendingBridgeAdd = new Map();

/**
 * Flux d'appel entièrement via REST ARI (quand le client Swagger n'a pas channels/bridges).
 * L'ajout du canal ExternalMedia au bridge est fait dans StasisStart quand Asterisk envoie l'événement.
 */
async function handleCallWithRestApi(rtp, rawChannel) {
  const chanId = rawChannel.id;
  try {
    rtp.resetSession();

    // Démarrer le pipeline tout de suite pour enregistrer son callback RTP avant que les paquets
    // du nouvel appel arrivent (évite que le 2e appel n'entende pas le message de bienvenue).
    if (env.DEEPGRAM_API_KEY) {
      const runtimeConfig = loadRuntimeConfig();
      const pipeline = env.USE_DEEPGRAM_AGENT
        ? new VoiceAgentPipeline(rtp, { channelId: chanId, ariBase, ariAuth, runtimeConfig })
        : new VoicePipeline(rtp);
      pipeline.start().catch((e) => log.error({ err: e, chanId }, "Voice pipeline error"));
      rtp.setActivePipeline(pipeline);
    }

    await axios.post(`${ariBase}/channels/${chanId}/answer`, {}, { auth: ariAuth });
    if (env.WELCOME_TONE) {
      try {
        await axios.post(`${ariBase}/channels/${chanId}/play`, { media: [env.WELCOME_TONE] }, { auth: ariAuth });
        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        /* ignore */
      }
    }
    const { data: bridge } = await axios.post(
      ariBase + "/bridges",
      { type: "mixing", name: `vb_${chanId}` },
      { auth: ariAuth }
    );
    await axios.post(`${ariBase}/bridges/${bridge.id}/addChannel`, { channel: chanId }, { auth: ariAuth });
    const mediaHost = env.MEDIA_SERVER_IP ?? env.ASTERISK_PUBLIC_IP;
    const externalHost = `${mediaHost}:${env.RTP_LISTEN_PORT}`;
    log.info({ externalHost }, "RTP target");
    const { data: ext } = await axios.post(
      ariBase + "/channels/externalMedia",
      null,
      {
        params: { app: env.ARI_APP, external_host: externalHost, format: "ulaw" },
        auth: ariAuth,
      }
    );
    ourExternalMediaIds.add(ext.id);
    log.info({ extId: ext.id }, "ExternalMedia created (attente StasisStart pour addChannel)");
    pendingBridgeAdd.set(ext.id, { bridgeId: bridge.id, externalHost, chanId });
  } catch (e) {
    log.error({ err: e, chanId }, "Error in call handling (REST)");
  }
}

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
      const raw = (channel && channel.id) ? channel : event.channel;
      if (!raw || !raw.id) {
        log.warn("StasisStart without channel id");
        return;
      }
      const chanId = raw.id;
      const pending = pendingBridgeAdd.get(chanId);
      if (pending) {
        pendingBridgeAdd.delete(chanId);
        try {
          await axios.post(`${ariBase}/bridges/${pending.bridgeId}/addChannel`, { channel: chanId }, { auth: ariAuth });
          log.info({ bridge: pending.bridgeId, extMedia: chanId, externalHost: pending.externalHost }, "Bridge + ExternalMedia ready (après StasisStart)");
        } catch (e) {
          log.error({ err: e, chanId, bridgeId: pending.bridgeId }, "addChannel (ExternalMedia) failed");
        }
        return;
      }
      if (ourExternalMediaIds.has(chanId)) {
        ourExternalMediaIds.delete(chanId);
        log.debug({ chanId }, "StasisStart for our ExternalMedia channel, skip");
        return;
      }
      if (raw.name && String(raw.name).toLowerCase().startsWith("externalmedia/")) {
        log.debug({ chanId, name: raw.name }, "StasisStart for ExternalMedia channel, skip");
        return;
      }
      log.info({ chanId, caller: raw.caller }, "StasisStart");

      if (!channel || typeof channel.answer !== "function") {
        await handleCallWithRestApi(rtp, raw);
        return;
      }

      try {
        rtp.resetSession();
        await channel.answer();

        if (env.WELCOME_TONE) {
          try {
            await playToneAndWait(client, channel, env.WELCOME_TONE);
          } catch (toneErr) {
            log.warn({ err: toneErr, chanId }, "Welcome tone failed, continuing without");
          }
        }

        const bridge = await client.bridges.create({ type: "mixing", name: `vb_${chanId}` });
        await bridge.addChannel({ channel: chanId });

        // Create external media channel pointing to our RTP server.
        // MEDIA_SERVER_IP = IP de la machine où Node tourne (celle qu'Asterisk doit joindre pour le RTP).
        const mediaHost = env.MEDIA_SERVER_IP ?? env.ASTERISK_PUBLIC_IP;
        const externalHost = `${mediaHost}:${env.RTP_LISTEN_PORT}`;
        log.info({ externalHost, hint: "Asterisk envoie le RTP ici; cette IP doit être celle de cette machine" }, "RTP target");

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
          const runtimeConfig = loadRuntimeConfig();
          const pipeline = env.USE_DEEPGRAM_AGENT
            ? new VoiceAgentPipeline(rtp, { channelId: chanId, ariBase, ariAuth, runtimeConfig })
            : new VoicePipeline(rtp);
          pipeline.start().catch((e) => log.error({ err: e, chanId }, "Voice pipeline error"));
        } else {
          log.warn("DEEPGRAM_API_KEY not set, voice pipeline disabled");
        }

      } catch (e) {
        log.error({ err: e, chanId }, "Error in call handling");
        try { await channel.hangup(); } catch { /* ignore hangup errors */ }
      }
    });

    client.start(env.ARI_APP);
    log.info({ app: env.ARI_APP }, "ARI Voicebot started (abonné à Stasis)");
    client.on("StasisEnd", (event, channel) => {
      log.info({ chanId: channel?.id }, "StasisEnd");
    });
  });
}
