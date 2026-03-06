import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LiveCallsSnapshot } from "@/types/voicebot-runtime";

function getLiveCallsPath() {
  return path.resolve(process.cwd(), "..", "..", "runtime", "live-calls.json");
}

export function readLiveCallsSnapshot(): LiveCallsSnapshot {
  const liveCallsPath = getLiveCallsPath();

  if (!existsSync(liveCallsPath)) {
    return {
      updatedAt: new Date(0).toISOString(),
      count: 0,
      calls: [],
    };
  }

  try {
    const raw = readFileSync(liveCallsPath, "utf8");
    const parsed = JSON.parse(raw) as LiveCallsSnapshot;
    if (!Array.isArray(parsed.calls)) {
      throw new Error("Format live-calls invalide");
    }
    return parsed;
  } catch {
    return {
      updatedAt: new Date(0).toISOString(),
      count: 0,
      calls: [],
    };
  }
}
