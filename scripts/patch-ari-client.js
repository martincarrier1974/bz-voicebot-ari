#!/usr/bin/env node
/**
 * Applique un correctif tolérant sur ari-client pour éviter le crash WebSocket
 * dans processMessage. Le script ne doit jamais faire échouer un build CI/CD
 * si le format exact du fichier varie d'une version à l'autre.
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

if (
  code.includes("[ari-client] processMessage error") ||
  code.includes("!self._swagger || !self._swagger.apis ||") ||
  code.includes("(self._swagger && self._swagger.apis && self._swagger.apis.events)")
) {
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

if (!changed && code.includes("var eventModels = self._swagger.apis.events.models")) {
  code = code.replace(
    /(\s*)var eventModels = self\._swagger\.apis\.events\.models;/,
    (_match, spaces) =>
      `${spaces}var eventModels = (self._swagger && self._swagger.apis && self._swagger.apis.events) ? self._swagger.apis.events.models : null;\n${spaces}if (!eventModels) return;`
  );
  changed = true;
}

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

if (code.includes(old1)) {
  code = code.replace(old1, new1);
  changed = true;
}

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

if (code.includes(old2)) {
  code = code.replace(old2, new2);
  changed = true;
}

if (!changed) {
  console.warn("Format ari-client inconnu, patch ignoré sans échec.");
  process.exit(0);
}

writeFileSync(clientPath, code);
console.log("Patch ari-client appliqué.");
