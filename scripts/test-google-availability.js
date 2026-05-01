import { loadRuntimeConfig } from "../src/config/runtimeConfig.js";
import { suggestGoogleSlots } from "../src/calendar/booking.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function serialize(result) {
  return JSON.parse(
    JSON.stringify(result, (key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const serviceSlug = String(args.service || "").trim();
  const preferredEmployeeName = String(args.employee || "").trim() || null;
  const dayInput = String(args.date || "").trim();

  if (!serviceSlug) {
    throw new Error("Usage: node scripts/test-google-availability.js --service <slug> [--employee <name>] [--date YYYY-MM-DD]");
  }

  const runtimeConfig = loadRuntimeConfig();
  if (!runtimeConfig) throw new Error("Runtime config not found or unreadable.");

  const day = dayInput ? new Date(`${dayInput}T00:00:00`) : new Date();
  if (Number.isNaN(day.getTime())) throw new Error(`Invalid date: ${dayInput}`);

  const result = await suggestGoogleSlots({
    runtimeConfig,
    serviceSlug,
    preferredEmployeeName,
    day,
  });

  console.log(JSON.stringify(serialize(result), null, 2));
}

main().catch((error) => {
  console.error("TEST_GOOGLE_AVAILABILITY_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
