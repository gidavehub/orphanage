import "server-only";

// Zoom Server-to-Server OAuth (integrations §6.2). The access token is cached in memory until a minute
// before it expires. Meetings are neutral: the topic is "Haven session" (never a client name or need),
// waiting room on, recording never. The host start URL is never stored: it's fetched on demand for the
// assigned counsellor's "Start as host".

import type { Millis } from "@/lib/model/enums";
import { env } from "@/lib/server/env";

export class ZoomError extends Error {
  constructor(readonly status: number, message = `Zoom answered ${status}.`) {
    super(message);
    this.name = "ZoomError";
  }
}

const G = globalThis as typeof globalThis & { __havenZoom?: { token: string; until: number } };

async function token(): Promise<string> {
  const cached = G.__havenZoom;
  if (cached && cached.until > Date.now()) return cached.token;
  const { accountId, clientId, clientSecret } = env.zoom;
  if (!accountId || !clientId || !clientSecret) throw new ZoomError(0, "Zoom isn't connected.");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new ZoomError(res.status, "Zoom refused the connection details.");
  const j = (await res.json()) as { access_token: string; expires_in: number };
  G.__havenZoom = { token: j.access_token, until: Date.now() + Math.max(60, j.expires_in - 60) * 1000 };
  return j.access_token;
}

async function zoomFetch<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T | null> {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return null;
  if (res.status === 404 && init.method === "DELETE") return null;
  if (!res.ok) throw new ZoomError(res.status);
  return (await res.json()) as T;
}

const zoomTime = (ms: Millis) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export async function createMeeting(a: { startsAt: Millis; durationMin: number; hostUser?: string | null }): Promise<{ meetingId: string; joinUrl: string; passcode: string | null }> {
  const host = a.hostUser || env.zoom.defaultHost;
  const r = await zoomFetch<{ id: number | string; join_url: string; password?: string }>(`/users/${encodeURIComponent(host)}/meetings`, {
    method: "POST",
    body: {
      topic: "Haven session",
      type: 2,
      start_time: zoomTime(a.startsAt),
      duration: a.durationMin,
      timezone: "UTC",
      settings: { waiting_room: true, join_before_host: false, mute_upon_entry: true, auto_recording: "none", approval_type: 2, meeting_authentication: false, private_meeting: true, host_video: true, participant_video: false, email_notification: false },
    },
  });
  if (!r?.join_url) throw new ZoomError(0, "Zoom didn't return a meeting link.");
  // start_url is deliberately not kept.
  return { meetingId: String(r.id), joinUrl: r.join_url, passcode: r.password ?? null };
}

export async function updateMeeting(id: string, startsAt: Millis, durationMin: number): Promise<void> {
  await zoomFetch(`/meetings/${encodeURIComponent(id)}`, { method: "PATCH", body: { start_time: zoomTime(startsAt), duration: durationMin } });
}

export async function deleteMeeting(id: string): Promise<void> {
  await zoomFetch(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** A fresh host start link (valid about 2 hours), never stored or emailed. */
export async function startUrl(id: string): Promise<string | null> {
  const r = await zoomFetch<{ start_url?: string }>(`/meetings/${encodeURIComponent(id)}`);
  return r?.start_url ?? null;
}
