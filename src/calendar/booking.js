import { env } from "../config/env.js";
import { getFreeBusy } from "./google.js";

function toMinutes(hhmm) {
  const [hours, minutes] = String(hhmm || "09:00").split(":").map((value) => Number(value || 0));
  return hours * 60 + minutes;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildWindow(day, minutes) {
  const result = new Date(day);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function normalizeBusyPeriods(freeBusyPayload, calendarId) {
  const busy = freeBusyPayload?.calendars?.[calendarId]?.busy || [];
  return busy
    .map((period) => ({ start: new Date(period.start), end: new Date(period.end) }))
    .filter((period) => !Number.isNaN(period.start.getTime()) && !Number.isNaN(period.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function findAvailableSlots({
  busyPeriods,
  day,
  durationMin,
  bufferBeforeMin = 0,
  bufferAfterMin = 0,
  slotStepMin = 15,
  businessHoursStart = env.BUSINESS_HOURS_START,
  businessHoursEnd = env.BUSINESS_HOURS_END,
  maxSlots = 3,
  now = new Date(),
}) {
  const dayStart = startOfDay(day);
  const workStart = buildWindow(dayStart, toMinutes(businessHoursStart));
  const workEnd = buildWindow(dayStart, toMinutes(businessHoursEnd));
  const effectiveDuration = durationMin + bufferBeforeMin + bufferAfterMin;
  const slots = [];

  for (let cursor = new Date(workStart); addMinutes(cursor, effectiveDuration) <= workEnd; cursor = addMinutes(cursor, slotStepMin)) {
    const actualStart = addMinutes(cursor, bufferBeforeMin);
    const actualEnd = addMinutes(actualStart, durationMin);
    const paddedStart = new Date(cursor);
    const paddedEnd = addMinutes(cursor, effectiveDuration);

    if (actualStart.getTime() < now.getTime()) {
      continue;
    }

    const blocked = busyPeriods.some((period) => overlaps(paddedStart, paddedEnd, period.start, period.end));
    if (!blocked) {
      slots.push({ start: actualStart, end: actualEnd, paddedStart, paddedEnd });
    }

    if (slots.length >= maxSlots) break;
  }

  return slots;
}

export function resolveBookingTargets(runtimeConfig, serviceSlug, preferredEmployeeName) {
  const services = Array.isArray(runtimeConfig?.bookingServices) ? runtimeConfig.bookingServices : [];
  const resources = Array.isArray(runtimeConfig?.calendarResources) ? runtimeConfig.calendarResources : [];
  const connections = Array.isArray(runtimeConfig?.calendarConnections) ? runtimeConfig.calendarConnections : [];

  const service = services.find((item) => item.slug === serviceSlug) || null;
  if (!service) return { service: null, targets: [] };

  const preferred = String(preferredEmployeeName || "").trim().toLowerCase();

  const targets = resources
    .filter((resource) => resource.provider === "google")
    .filter((resource) => Array.isArray(resource.supportedServices) && resource.supportedServices.some((item) => item.serviceSlug === serviceSlug))
    .filter((resource) => {
      if (!preferred) return true;
      const haystacks = [resource.employeeName, resource.name].filter(Boolean).map((value) => String(value).trim().toLowerCase());
      return haystacks.some((value) => value.includes(preferred));
    })
    .map((resource) => {
      const connection = connections.find((item) => item.name === resource.connectionName) || null;
      const relation = resource.supportedServices.find((item) => item.serviceSlug === serviceSlug) || null;
      return {
        resource,
        connection,
        priority: relation?.priority ?? 999,
        calendarId: String(resource.calendarId || connection?.defaultCalendarId || "").trim(),
      };
    })
    .filter((item) => item.connection && item.calendarId)
    .sort((a, b) => a.priority - b.priority || String(a.resource.name).localeCompare(String(b.resource.name), "fr"));

  return { service, targets };
}

export async function suggestGoogleSlots({
  runtimeConfig,
  serviceSlug,
  preferredEmployeeName,
  day = new Date(),
  maxSlotsPerEmployee = 3,
}) {
  const { service, targets } = resolveBookingTargets(runtimeConfig, serviceSlug, preferredEmployeeName);
  if (!service) return { service: null, suggestions: [], reason: "service_not_found" };
  if (targets.length === 0) {
    return {
      service,
      suggestions: [],
      reason: preferredEmployeeName ? "employee_not_found_or_unavailable" : "no_calendar_target",
    };
  }

  const dayStart = startOfDay(day);
  const nextDay = addMinutes(dayStart, 24 * 60);
  const results = [];

  for (const target of targets) {
    const timeZone = target.resource.timezone || target.connection.timezone || env.TIMEZONE;
    const freeBusy = await getFreeBusy({
      connection: target.connection,
      calendarIds: [target.calendarId],
      timeMin: dayStart.toISOString(),
      timeMax: nextDay.toISOString(),
      timeZone,
    });

    const busyPeriods = normalizeBusyPeriods(freeBusy, target.calendarId);
    const slots = findAvailableSlots({
      busyPeriods,
      day,
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      maxSlots: maxSlotsPerEmployee,
    });

    results.push({
      employeeName: target.resource.employeeName || target.resource.name,
      resourceName: target.resource.name,
      calendarId: target.calendarId,
      slots,
    });
  }

  return { service, suggestions: results, reason: null };
}
