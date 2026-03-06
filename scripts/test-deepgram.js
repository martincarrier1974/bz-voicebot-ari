/**
 * Test rapide : vérifie que la clé Deepgram est valide et que la connexion STT fonctionne.
 * Usage: node scripts/test-deepgram.js   ou   npm run test:deepgram
 */
import "dotenv/config";
import WebSocket from "ws";
import { env } from "../src/config/env.js";

const KEY = env.DEEPGRAM_API_KEY;
const MODEL = env.DG_STT_MODEL ?? "nova-2";

if (!KEY) {
  console.error("❌ DEEPGRAM_API_KEY manquant dans .env");
  process.exit(1);
}

const url = new URL("wss://api.deepgram.com/v1/listen");
url.searchParams.set("encoding", "mulaw");
url.searchParams.set("sample_rate", "8000");
url.searchParams.set("channels", "1");
url.searchParams.set("model", MODEL);

console.log("Connexion à Deepgram (STT)...");
const ws = new WebSocket(url.toString(), {
  headers: { Authorization: `Token ${KEY}` },
});

const timeout = setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.error("❌ Timeout : pas de réponse de Deepgram");
    ws.terminate();
    process.exit(1);
  }
}, 10000);

ws.on("open", () => {
  clearTimeout(timeout);
  console.log("✅ Connecté à Deepgram (clé valide, réseau OK).");
  ws.close();
  process.exit(0);
});

ws.on("error", (err) => {
  clearTimeout(timeout);
  console.error("❌ Erreur Deepgram:", err.message);
  process.exit(1);
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "error" || msg.msg) {
    console.error("❌ Deepgram:", msg.msg || msg);
    clearTimeout(timeout);
    ws.terminate();
    process.exit(1);
  }
});
