import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

const runtimeDir = path.resolve(process.cwd(), path.dirname(env.RUNTIME_CONFIG_PATH));
const liveCallsPath = path.join(runtimeDir, "live-calls.json");
const calls = new Map();

let flushTimer = null;

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function buildSnapshot() {
  return {
    updatedAt: new Date().toISOString(),
    count: calls.size,
    calls: [...calls.values()].sort((a, b) => b.session.startedAt - a.session.startedAt),
  };
}

function flushNow() {
  flushTimer = null;
  try {
    ensureRuntimeDir();
    fs.writeFileSync(liveCallsPath, JSON.stringify(buildSnapshot(), null, 2), "utf8");
  } catch (error) {
    log.error({ err: error, liveCallsPath }, "Impossible d'écrire live-calls.json");
  }
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = setTimeout(flushNow, 100);
}

export function upsertLiveCall(callState) {
  if (!callState?.session?.callId) return;
  calls.set(callState.session.callId, structuredClone(callState));
  scheduleFlush();
}

export function removeLiveCall(callId) {
  if (!callId) return;
  calls.delete(callId);
  scheduleFlush();
}

export function getLiveCallsPath() {
  return liveCallsPath;
}
