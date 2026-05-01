import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LiveCallsSnapshot } from "@/types/voicebot-runtime";
import { getLiveCallsPathForTenant } from "@/lib/tenant";

function resolveLiveCallsPath(runtimeRelativePath?: string | null) {
  const relativePath = runtimeRelativePath || "runtime/live-calls.json";
  return path.resolve(process.cwd(), "..", "..", relativePath);
}

export function readLiveCallsSnapshot(tenant?: { slug: string; runtimeConfigPath?: string | null } | null): LiveCallsSnapshot {
  const liveCallsPath = resolveLiveCallsPath(tenant ? getLiveCallsPathForTenant(tenant) : undefined);

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
