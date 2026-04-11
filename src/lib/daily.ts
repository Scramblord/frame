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
