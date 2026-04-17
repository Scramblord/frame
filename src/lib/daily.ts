/**
 * Server-only Daily.co REST API helpers. Uses DAILY_API_KEY — never import in client code.
 */

const DAILY_API_BASE = "https://api.daily.co/v1";

function getApiKey(): string | null {
  const k = process.env.DAILY_API_KEY?.trim();
  return k || null;
}

function roomExpiryUnix(
  scheduledAt: Date,
  durationMinutes: number,
  graceMinutes = 10,
): number {
  const ms =
    scheduledAt.getTime() + (durationMinutes + graceMinutes) * 60 * 1000;
  return Math.floor(ms / 1000);
}

export type CreateDailyRoomResult =
  | { ok: true; roomName: string; roomUrl: string }
  | { ok: false; error: string };

function dailyDuplicateRoomHeuristic(status: number, body: unknown): boolean {
  if (status === 409) return true;
  const text =
    typeof body === "string"
      ? body
      : JSON.stringify(body ?? {}).toLowerCase();
  return /already\s+exists|already-exists|duplicate|name-taken|name_taken|room.*exists|not\s+unique|unique.*constraint|conflict/i.test(
    text,
  );
}

async function fetchDailyRoomByName(
  apiKey: string,
  roomName: string,
): Promise<{ ok: true; roomName: string; roomUrl: string } | { ok: false }> {
  try {
    const res = await fetch(
      `${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    const data = (await res.json()) as {
      url?: string;
      name?: string;
      error?: string;
    };
    if (!res.ok || !data.url || !data.name) {
      return { ok: false };
    }
    return { ok: true, roomName: data.name, roomUrl: data.url };
  } catch (e) {
    console.error("fetchDailyRoomByName", e);
    return { ok: false };
  }
}

/**
 * Creates a private Daily room for a booking. Room name: `frame-{bookingId}`.
 * If create fails because the room already exists, fetches it via GET /rooms/:name.
 */
export async function createDailyRoom(params: {
  bookingId: string;
  scheduledAt: Date;
  durationMinutes: number;
}): Promise<CreateDailyRoomResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "DAILY_API_KEY is not configured" };
  }

  const { bookingId, scheduledAt, durationMinutes } = params;
  const name = `frame-${bookingId}`;
  const exp = roomExpiryUnix(scheduledAt, durationMinutes);

  try {
    const res = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        privacy: "private",
        properties: {
          exp,
          max_participants: 2,
          enable_chat: false,
          start_audio_off: false,
          start_video_off: false,
        },
      }),
    });

    let data: { url?: string; name?: string; error?: string };
    try {
      data = (await res.json()) as {
        url?: string;
        name?: string;
        error?: string;
      };
    } catch {
      data = {};
    }

    if (!res.ok) {
      if (dailyDuplicateRoomHeuristic(res.status, data)) {
        console.log("[frame:daily] create returned duplicate/conflict, fetching room", {
          roomName: name,
          status: res.status,
        });
        const existing = await fetchDailyRoomByName(apiKey, name);
        if (existing.ok) {
          return {
            ok: true,
            roomName: existing.roomName,
            roomUrl: existing.roomUrl,
          };
        }
      }
      return {
        ok: false,
        error: data.error ?? `Daily create room failed (${res.status})`,
      };
    }

    if (!data.url || !data.name) {
      return { ok: false, error: "Daily response missing url or name" };
    }

    return { ok: true, roomName: data.name, roomUrl: data.url };
  } catch (e) {
    console.error("createDailyRoom", e);
    return { ok: false, error: "Daily create room request failed" };
  }
}

export type CreateMeetingTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Creates a meeting token for joining a private room.
 */
export async function createMeetingToken(params: {
  roomName: string;
  participantName: string;
  isOwner: boolean;
  expUnix: number;
}): Promise<CreateMeetingTokenResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "DAILY_API_KEY is not configured" };
  }

  const { roomName, participantName, isOwner, expUnix } = params;

  try {
    const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: participantName,
          is_owner: isOwner,
          exp: expUnix,
        },
      }),
    });

    const data = (await res.json()) as {
      token?: string;
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `Daily meeting token failed (${res.status})`,
      };
    }

    if (!data.token) {
      return { ok: false, error: "Daily token response missing token" };
    }

    return { ok: true, token: data.token };
  } catch (e) {
    console.error("createMeetingToken", e);
    return { ok: false, error: "Daily meeting token request failed" };
  }
}

export function sessionRoomExpiryUnix(
  scheduledAt: Date,
  durationMinutes: number,
): number {
  return roomExpiryUnix(scheduledAt, durationMinutes);
}

export type DailyWebhook = {
  uuid: string;
  url: string;
  hmac?: string;
  eventTypes?: string[];
};

export type EnsureDailyWebhookSubscriptionResult =
  | { ok: true; action: "created" | "updated" | "no-op"; webhook: DailyWebhook }
  | { ok: false; error: string };

type DailyWebhookListResponse = {
  data?: DailyWebhook[];
  webhooks?: DailyWebhook[];
};

function normalizeWebhookList(payload: unknown): DailyWebhook[] {
  if (Array.isArray(payload)) {
    return payload as DailyWebhook[];
  }
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as DailyWebhookListResponse;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.webhooks)) return obj.webhooks;
  return [];
}

async function listDailyWebhooks(
  apiKey: string,
): Promise<{ ok: true; webhooks: DailyWebhook[] } | { ok: false; error: string }> {
  try {
    console.log("[frame:daily-webhook-sync] Daily API list webhooks start");
    const res = await fetch(`${DAILY_API_BASE}/webhooks`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      data = null;
    }
    console.log("[frame:daily-webhook-sync] Daily API list webhooks response", {
      status: res.status,
      ok: res.ok,
      bodyRaw: raw,
      bodyParsed: data,
    });
    if (!res.ok) {
      const error =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error ?? "")
          : "";
      return {
        ok: false,
        error: error || `Daily list webhooks failed (${res.status})`,
      };
    }
    return { ok: true, webhooks: normalizeWebhookList(data) };
  } catch (e) {
    console.error("listDailyWebhooks", e);
    return { ok: false, error: "Daily list webhooks request failed" };
  }
}

async function createDailyWebhook(
  apiKey: string,
  params: { endpoint: string; secret: string },
): Promise<{ ok: true; webhook: DailyWebhook } | { ok: false; error: string }> {
  try {
    console.log("[frame:daily-webhook-sync] Daily API create webhook start", {
      endpoint: params.endpoint,
      eventTypes: ["meeting.ended"],
    });
    const res = await fetch(`${DAILY_API_BASE}/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: params.endpoint,
        hmac: params.secret,
        eventTypes: ["meeting.ended"],
      }),
    });
    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      data = null;
    }
    console.log("[frame:daily-webhook-sync] Daily API create webhook response", {
      status: res.status,
      ok: res.ok,
      bodyRaw: raw,
      bodyParsed: data,
    });
    const parsed = (data ?? {}) as {
      uuid?: string;
      url?: string;
      hmac?: string;
      eventTypes?: string[];
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: parsed.error ?? `Daily create webhook failed (${res.status})`,
      };
    }
    if (!parsed.uuid || !parsed.url) {
      return { ok: false, error: "Daily webhook response missing uuid or url" };
    }
    return {
      ok: true,
      webhook: {
        uuid: parsed.uuid,
        url: parsed.url,
        hmac: parsed.hmac,
        eventTypes: parsed.eventTypes,
      },
    };
  } catch (e) {
    console.error("createDailyWebhook", e);
    return { ok: false, error: "Daily create webhook request failed" };
  }
}

async function deleteDailyWebhook(
  apiKey: string,
  uuid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    console.log("[frame:daily-webhook-sync] Daily API delete webhook start", {
      webhookUuid: uuid,
    });
    const res = await fetch(`${DAILY_API_BASE}/webhooks/${encodeURIComponent(uuid)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      const raw = await res.text();
      let data: { error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        data = {};
      }
      console.error("[frame:daily-webhook-sync] Daily API delete webhook failed", {
        webhookUuid: uuid,
        status: res.status,
        bodyRaw: raw,
        bodyParsed: data,
      });
      return {
        ok: false,
        error: data.error ?? `Daily delete webhook failed (${res.status})`,
      };
    }
    console.log("[frame:daily-webhook-sync] Daily API delete webhook success", {
      webhookUuid: uuid,
      status: res.status,
    });
    return { ok: true };
  } catch (e) {
    console.error("deleteDailyWebhook", e);
    return { ok: false, error: "Daily delete webhook request failed" };
  }
}

export async function ensureDailyWebhookSubscription(params: {
  endpoint: string;
  secret: string;
}): Promise<EnsureDailyWebhookSubscriptionResult> {
  console.log("[frame:daily-webhook-sync] ensure subscription start", {
    endpoint: params.endpoint,
  });
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "DAILY_API_KEY is not configured" };
  }
  const endpoint = params.endpoint.trim();
  const secret = params.secret.trim();
  if (!endpoint) {
    return { ok: false, error: "endpoint is required" };
  }
  if (!secret) {
    return { ok: false, error: "secret is required" };
  }

  const listed = await listDailyWebhooks(apiKey);
  if (!listed.ok) {
    console.error("[frame:daily-webhook-sync] list webhooks failed", {
      endpoint,
      error: listed.error,
    });
    return { ok: false, error: listed.error };
  }
  console.log("[frame:daily-webhook-sync] list webhooks success", {
    endpoint,
    count: listed.webhooks.length,
  });

  const existing = listed.webhooks.find((w) => w.url?.trim() === endpoint);
  if (existing) {
    console.log("[frame:daily-webhook-sync] found existing endpoint webhook", {
      endpoint,
      webhookUuid: existing.uuid,
    });
    const existingSecret = existing.hmac?.trim() ?? "";
    if (existingSecret && existingSecret === secret) {
      console.log("[frame:daily-webhook-sync] existing webhook secret matches; no-op", {
        endpoint,
        webhookUuid: existing.uuid,
      });
      return { ok: true, action: "no-op", webhook: existing };
    }
    console.log("[frame:daily-webhook-sync] existing webhook secret mismatch; rotate webhook", {
      endpoint,
      webhookUuid: existing.uuid,
    });
    const del = await deleteDailyWebhook(apiKey, existing.uuid);
    if (!del.ok) {
      console.error("[frame:daily-webhook-sync] delete existing webhook failed", {
        endpoint,
        webhookUuid: existing.uuid,
        error: del.error,
      });
      return { ok: false, error: del.error };
    }
    const created = await createDailyWebhook(apiKey, { endpoint, secret });
    if (!created.ok) {
      console.error("[frame:daily-webhook-sync] recreate webhook failed", {
        endpoint,
        error: created.error,
      });
      return { ok: false, error: created.error };
    }
    console.log("[frame:daily-webhook-sync] webhook rotated successfully", {
      endpoint,
      webhookUuid: created.webhook.uuid,
    });
    return { ok: true, action: "updated", webhook: created.webhook };
  }

  console.log("[frame:daily-webhook-sync] no existing endpoint webhook; creating", {
    endpoint,
  });
  const created = await createDailyWebhook(apiKey, { endpoint, secret });
  if (!created.ok) {
    console.error("[frame:daily-webhook-sync] create webhook failed", {
      endpoint,
      error: created.error,
    });
    return { ok: false, error: created.error };
  }
  console.log("[frame:daily-webhook-sync] create webhook succeeded", {
    endpoint,
    webhookUuid: created.webhook.uuid,
  });
  return { ok: true, action: "created", webhook: created.webhook };
}
