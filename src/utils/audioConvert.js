/**
 * Conversion linear16 (PCM 16-bit signed LE) -> mulaw 8kHz pour RTP.
 * Utilisé quand l'agent Deepgram renvoie linear16 24kHz.
 * Formule G.711 µ-law.
 */

const MULAW_BIAS = 33;
const MULAW_CLIP = 32635;

/**
 * Encode un sample 16-bit signed en µ-law (8-bit).
 * @param {number} sample int16
 * @returns {number} uint8
 */
function encodeMulawSample(sample) {
  const sign = sample < 0 ? 0x80 : 0;
  if (sign) sample = -sample;
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * Convertit un buffer linear16 (16-bit signed LE) à une fréquence donnée
 * vers mulaw 8kHz. Resampling par décimation (prend 1 sample sur ratio).
 * @param {Buffer} linear16 - buffer PCM 16-bit LE
 * @param {number} inputRate - fréquence d'entrée (ex: 24000)
 * @returns {Buffer} mulaw 8kHz
 */
export function linear16ToMulaw8k(linear16, inputRate = 24000) {
  if (!linear16 || linear16.length < 2) return Buffer.alloc(0);
  const ratio = inputRate / 8000; // 3 pour 24k->8k
  const numSamplesIn = Math.floor(linear16.length / 2);
  const numSamplesOut = Math.floor(numSamplesIn / ratio);
  const out = Buffer.alloc(numSamplesOut);
  for (let i = 0; i < numSamplesOut; i++) {
    const srcIdx = Math.min(Math.floor(i * ratio) * 2, linear16.length - 2);
    const sample = linear16.readInt16LE(srcIdx);
    out[i] = encodeMulawSample(sample);
  }
  return out;
}
