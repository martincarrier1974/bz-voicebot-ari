import { env } from "../config/env.js";

export function resolveCalendarMailbox(service) {
  const s = (service || "").toLowerCase();

  if (s.includes("support") || s.includes("ticket") || s.includes("problème")) return env.CAL_SUPPORT;
  if (s.includes("vente") || s.includes("soumission") || s.includes("prix")) return env.CAL_SALES;
  if (s.includes("câbl") || s.includes("cabl") || s.includes("fibre")) return env.CAL_CABLING;

  // default fallback
  return env.CAL_SALES || env.CAL_SUPPORT || env.CAL_CABLING;
}
