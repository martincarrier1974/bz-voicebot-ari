/**
 * Correctif pour ari-client + swagger-client v2.2 :
 * 1) swagger n'expose pas authorizations → on l'initialise.
 * 2) ari-client appelle new SwaggerApi({ url, success, failure }) sans passer
 *    authorizations → le SwaggerClient fait la requête resources.json sans auth → 401.
 *    On wrappe SwaggerApi pour injecter les authorizations globales dans les options.
 */
import { createRequire } from "module";

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
