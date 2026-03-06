import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";
import { log } from "../utils/logger.js";

function getRuntimeConfigPath() {
  return path.resolve(process.cwd(), env.RUNTIME_CONFIG_PATH);
}

export function loadRuntimeConfig() {
  const configPath = getRuntimeConfigPath();
  if (!fs.existsSync(configPath)) {
    log.info({ configPath }, "Runtime config introuvable, configuration statique utilisée");
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    log.info({ configPath, generatedAt: parsed.generatedAt }, "Runtime config chargée");
    return parsed;
  } catch (error) {
    log.error({ err: error, configPath }, "Impossible de lire la runtime config");
    return null;
  }
}
