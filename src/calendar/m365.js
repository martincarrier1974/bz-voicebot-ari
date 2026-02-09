import axios from "axios";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

let cachedToken = null;
let cachedExp = 0;

async function getToken() {
  if (!env.M365_TENANT_ID || !env.M365_CLIENT_ID || !env.M365_CLIENT_SECRET) {
    throw new Error("M365 env vars missing. Fill M365_TENANT_ID / CLIENT_ID / CLIENT_SECRET.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExp - 60 > now) return cachedToken;

  const url = `https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", env.M365_CLIENT_ID);
  params.append("client_secret", env.M365_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");
  params.append("scope", "https://graph.microsoft.com/.default");

  const { data } = await axios.post(url, params);
  cachedToken = data.access_token;

  // exp is a JWT claim; to keep simple, cache ~50 minutes if not decoded
  cachedExp = now + 50 * 60;

  log.info("Graph token refreshed");
  return cachedToken;
}

function graphHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function getSchedule({ mailbox, startISO, endISO, intervalMin = 30 }) {
  const token = await getToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/getSchedule`;

  const body = {
    schedules: [mailbox],
    startTime: { dateTime: startISO, timeZone: env.TIMEZONE },
    endTime: { dateTime: endISO, timeZone: env.TIMEZONE },
    availabilityViewInterval: intervalMin,
  };

  const { data } = await axios.post(url, body, { headers: graphHeaders(token) });
  return data;
}

export async function createEvent({ mailbox, subject, startISO, endISO, bodyText, attendeeEmail }) {
  const token = await getToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/events`;

  const body = {
    subject,
    body: { contentType: "Text", content: bodyText || "" },
    start: { dateTime: startISO, timeZone: env.TIMEZONE },
    end: { dateTime: endISO, timeZone: env.TIMEZONE },
    attendees: attendeeEmail
      ? [{ emailAddress: { address: attendeeEmail }, type: "required" }]
      : [],
  };

  const { data } = await axios.post(url, body, { headers: graphHeaders(token) });
  return data;
}
