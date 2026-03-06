#!/usr/bin/env node
/**
 * Correctif à exécuter sur le serveur Linux après npm install.
 * Corrige le crash "Cannot read properties of undefined (reading 'models')"
 * dans ari-client/lib/client.js (processMessage).
 */
const fs = require("fs");
const path = require("path");

const clientPath = path.join(__dirname, "..", "node_modules", "ari-client", "lib", "client.js");
if (!fs.existsSync(clientPath)) {
  console.error("Fichier introuvable:", clientPath);
  process.exit(1);
}

let code = fs.readFileSync(clientPath, "utf8");

// 1) Sécuriser la condition if (plusieurs variantes possibles)
const guards = [
  ["if (!self._swagger.apis.events || !self._swagger.apis.events.models)", "if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models)"],
  ["if (!self._swagger.apis.events || !self._swagger.apis.events.models) {", "if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models) {"],
];
let changed = false;
for (const [oldStr, newStr] of guards) {
  if (code.includes(oldStr) && !code.includes("!self._swagger || !self._swagger.apis ||")) {
    code = code.replace(oldStr, newStr);
    changed = true;
    break;
  }
}

// 2) Si la condition n'a pas été trouvée, sécuriser la ligne eventModels
if (!changed && code.includes("var eventModels = self._swagger.apis.events.models")) {
  const safeLine = "var eventModels = (self._swagger && self._swagger.apis && self._swagger.apis.events) ? self._swagger.apis.events.models : null;";
  const returnLine = "if (!eventModels) return;";
  code = code.replace(
    /(\s*)var eventModels = self\._swagger\.apis\.events\.models;/,
    (m, spaces) => `${spaces}${safeLine}\n${spaces}${returnLine}`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(clientPath, code);
  console.log("Correctif ari-client appliqué.");
} else if (code.includes("!self._swagger || !self._swagger.apis ||") || code.includes("(self._swagger && self._swagger.apis &&")) {
  console.log("Déjà patché.");
} else {
  console.error("Impossible d'appliquer le correctif (format du fichier inconnu).");
  process.exit(1);
}
