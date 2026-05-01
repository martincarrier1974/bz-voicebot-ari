import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const tokenCache = new Map();

function getConnectionCacheKey(connection) {
  return connection?.name || connection?.clientId || connection?.accountEmail || "google";
}

function getGoogleCred(connection, key, envValue) {
  const value = connection?.[key] || envValue;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getAccessToken(connection) {
  const clientId = getGoogleCred(connection, "clientId", env.GOOGLE_CLIENT_ID);
  const clientSecret = getGoogleCred(connection, "clientSecret", env.GOOGLE_CLIENT_SECRET);
  const refreshToken = getGoogleCred(connection, "refreshToken", env.GOOGLE_REFRESH_TOKEN);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar credentials missing. Need clientId, clientSecret and refreshToken.");
  }

  const cacheKey = getConnectionCacheKey(connection);
  const cached = tokenCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.accessToken;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  const expiresIn = Number(data.expires_in || 3600);

  if (!accessToken) {
    throw new Error("Google token refresh failed: access_token missing in response.");
  }

  tokenCache.set(cacheKey, {
    accessToken,
    expiresAt: now + expiresIn,
  });

  log.info({ cacheKey }, "Google Calendar token refreshed");
  return accessToken;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function normalizeCalendarIds(calendarIds, connection) {
  const ids = Array.isArray(calendarIds)
    ? calendarIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (ids.length > 0) return ids;

  const fallback = typeof connection?.defaultCalendarId === "string" ? connection.defaultCalendarId.trim() : "";
  return fallback ? [fallback] : [];
}

export async function getFreeBusy({ connection, calendarIds, timeMin, timeMax, timeZone }) {
  const ids = normalizeCalendarIds(calendarIds, connection);
  if (ids.length === 0) throw new Error("No Google calendarId provided for freeBusy lookup.");

  const accessToken = await getAccessToken(connection);
  const response = await fetch(GOOGLE_FREEBUSY_URL, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: timeZone || connection?.timezone || env.TIMEZONE,
      items: ids.map((id) => ({ id })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google freeBusy failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function listEvents({ connection, calendarId, timeMin, timeMax, timeZone }) {
  const resolvedCalendarId = String(calendarId || connection?.defaultCalendarId || "").trim();
  if (!resolvedCalendarId) throw new Error("No Google calendarId provided for listEvents.");

  const accessToken = await getAccessToken(connection);
  const url = new URL(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(resolvedCalendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("timeZone", timeZone || connection?.timezone || env.TIMEZONE);

  const response = await fetch(url, { headers: authHeaders(accessToken) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google listEvents failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function createEvent({
  connection,
  calendarId,
  summary,
  description,
  startISO,
  endISO,
  attendeeEmail,
  attendeeName,
  timeZone,
}) {
  const resolvedCalendarId = String(calendarId || connection?.defaultCalendarId || "").trim();
  if (!resolvedCalendarId) throw new Error("No Google calendarId provided for createEvent.");

  const accessToken = await getAccessToken(connection);
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(resolvedCalendarId)}/events`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      summary,
      description: description || "",
      start: { dateTime: startISO, timeZone: timeZone || connection?.timezone || env.TIMEZONE },
      end: { dateTime: endISO, timeZone: timeZone || connection?.timezone || env.TIMEZONE },
      attendees: attendeeEmail ? [{ email: attendeeEmail, displayName: attendeeName || undefined }] : [],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google createEvent failed (${response.status}): ${text}`);
  }

  return response.json();
}
