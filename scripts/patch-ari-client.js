#!/usr/bin/env node
/**
 * Applique un correctif tolérant et non destructif sur ari-client.
 * On évite ici toute réécriture structurelle de processMessage (try/catch),
 * car certaines variantes du fichier peuvent produire un JS invalide.
 * Le script ne fait qu'ajouter des gardes sûres autour de _swagger/events/models.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientPath = join(__dirname, "..", "node_modules", "ari-client", "lib", "client.js");

if (!existsSync(clientPath)) {
  console.warn("ari-client introuvable, patch ignoré.");
  process.exit(0);
}

let code = readFileSync(clientPath, "utf8");

if (code.includes("!self._swagger || !self._swagger.apis ||") || code.includes("(self._swagger && self._swagger.apis && self._swagger.apis.events)")) {
  console.log("ari-client déjà patché ou protégé, rien à faire.");
  process.exit(0);
}

let changed = false;

const guardVariants = [
  [
    "if (!self._swagger.apis.events || !self._swagger.apis.events.models)",
    "if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models)",
  ],
  [
    "if (!self._swagger.apis.events || !self._swagger.apis.events.models) {",
    "if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models) {",
  ],
];

for (const [oldStr, newStr] of guardVariants) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    changed = true;
    break;
  }
}

if (code.includes("var eventModels = self._swagger.apis.events.models")) {
  code = code.replace(
    /(\s*)var eventModels = self\._swagger\.apis\.events\.models;/,
    (_match, spaces) =>
      `${spaces}var eventModels = (self._swagger && self._swagger.apis && self._swagger.apis.events) ? self._swagger.apis.events.models : null;\n${spaces}if (!eventModels) return;`
  );
  changed = true;
}

if (!changed) {
  console.warn("Format ari-client inconnu, patch ignoré sans échec.");
  process.exit(0);
}

writeFileSync(clientPath, code);
console.log("Patch ari-client appliqué.");
