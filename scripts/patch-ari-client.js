#!/usr/bin/env node
/**
 * Applique le correctif sur ari-client pour éviter le crash WebSocket
 * (processMessage: try-catch + gardes apis/eventModel.properties + msg Buffer->string).
 * À lancer une fois après: npm install
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientPath = join(__dirname, "..", "node_modules", "ari-client", "lib", "client.js");

let code = readFileSync(clientPath, "utf8");

// Déjà patché ?
if (code.includes("[ari-client] processMessage error")) {
  console.log("ari-client déjà patché, rien à faire.");
  process.exit(0);
}

// Correctif minimal si le bloc complet n'est pas trouvé : sécuriser la ligne .apis.events
if (code.includes("!self._swagger.apis.events || !self._swagger.apis.events.models") && !code.includes("!self._swagger || !self._swagger.apis ||")) {
  code = code.replace(
    "if (!self._swagger.apis.events || !self._swagger.apis.events.models) {",
    "if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models) {"
  );
  writeFileSync(clientPath, code);
  console.log("Patch ari-client (gardes minimales) appliqué.");
  process.exit(0);
}

// 1) Remplacer le début de processMessage (event = JSON.parse(msg) + gardes)
const old1 = `    function processMessage (msg, flags) {
      var event = {};
      if (msg) {
        event = JSON.parse(msg);
      }
      if (!self._swagger.apis.events || !self._swagger.apis.events.models) {
        return;
      }
      var eventModels = self._swagger.apis.events.models;
      var eventModel = _.find(eventModels, function (item, key) {
        return key === event.type;
      });
      if (!eventModel) {
        return;
      }
      var resources = {};
      var instanceIds = [];

      // Pass in any property that is a known type as an object
      _.each(eventModel.properties, function (prop) {`;

const new1 = `    function processMessage (msg, flags) {
      try {
        var event = {};
        if (msg) {
          var raw = (typeof msg === 'string') ? msg : (msg && msg.toString ? msg.toString() : String(msg));
          event = JSON.parse(raw);
        }
        if (!self._swagger || !self._swagger.apis || !self._swagger.apis.events || !self._swagger.apis.events.models) {
          return;
        }
        var eventModels = self._swagger.apis.events.models;
        var eventModel = _.find(eventModels, function (item, key) {
          return key === event.type;
        });
        if (!eventModel || !eventModel.properties) {
          return;
        }
        var resources = {};
        var instanceIds = [];

        // Pass in any property that is a known type as an object
        _.each(eventModel.properties, function (prop) {`;

if (!code.includes(old1)) {
  console.error("Impossible de trouver le bloc à remplacer (début processMessage). Version ari-client peut-être différente.");
  process.exit(1);
}
code = code.replace(old1, new1);

// 2) Ajouter le catch avant la fin de processMessage
const old2 = `      self.emit(event.type, event, resources);
      // If appropriate, emit instance specific events
      if (instanceIds.length > 0) {
        _.each(instanceIds, function (instanceId) {
          self.emit(
            util.format('%s-%s', event.type, instanceId),
            event,
            resources
          );
        });
      }
    }

    /**
     *  Process open event.`;

const new2 = `      self.emit(event.type, event, resources);
      // If appropriate, emit instance specific events
      if (instanceIds.length > 0) {
        _.each(instanceIds, function (instanceId) {
          self.emit(
            util.format('%s-%s', event.type, instanceId),
            event,
            resources
          );
        });
      }
      } catch (err) {
        var et = (event && event.type) ? event.type : '?';
        console.error('[ari-client] processMessage error:', err.message, 'event.type=', et);
      }
    }

    /**
     *  Process open event.`;

if (!code.includes(old2)) {
  console.error("Impossible de trouver le bloc pour ajouter le catch.");
  process.exit(1);
}
code = code.replace(old2, new2);

writeFileSync(clientPath, code);
console.log("Patch ari-client appliqué avec succès.");
