/**
 * Correctifs de compatibilité pour l'ancien couple ari-client + swagger-client.
 *
 * 1) swagger n'expose pas toujours `authorizations` → on l'initialise.
 * 2) ari-client charge le swagger sans auth si on ne réinjecte pas les authz.
 * 3) sur certains runtimes, ari-client peut ignorer des events ARI si le modèle
 *    Swagger des events est absent/incomplet. On rend ce chemin tolérant pour
 *    que les événements bruts (ex: StasisStart) remontent quand même.
 */
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const swagger = require("swagger-client");
const auth = require("swagger-client/lib/auth");

if (!swagger.authorizations) {
  swagger.authorizations = new auth.SwaggerAuthorizations();
}

const OriginalSwaggerApi = swagger.SwaggerApi;
swagger.SwaggerApi = function (urlOrOptions, options) {
  const opts = urlOrOptions && typeof urlOrOptions === "object" ? { ...urlOrOptions } : urlOrOptions;
  if (opts && typeof opts === "object" && opts.url && !opts.authorizations && swagger.authorizations?.authz) {
    opts.authorizations = swagger.authorizations.authz;
  }
  return OriginalSwaggerApi.call(this, opts, options);
};

function patchAriClientEventHandling() {
  let clientPath;
  try {
    clientPath = require.resolve("ari-client/lib/client.js");
  } catch {
    return;
  }

  let source = fs.readFileSync(clientPath, "utf8");
  let updated = source;

  updated = updated.replace(
    "      var eventModels = (self._swagger && self._swagger.apis && self._swagger.apis.events) ? self._swagger.apis.events.models : null;\n\n      if (!eventModels) return;\n      var eventModel = _.find(eventModels, function (item, key) {\n        return key === event.type;\n      });\n",
    "      var eventModels = (self._swagger && self._swagger.apis && self._swagger.apis.events) ? self._swagger.apis.events.models : null;\n      var eventModel = eventModels ? _.find(eventModels, function (item, key) {\n        return key === event.type;\n      }) : null;\n"
  );

  updated = updated.replace(
    "      _.each(eventModel.properties, function (prop) {\n",
    "      _.each((eventModel && eventModel.properties) || [], function (prop) {\n"
  );

  if (updated !== source) {
    fs.writeFileSync(clientPath, updated, "utf8");
  }
}

patchAriClientEventHandling();
