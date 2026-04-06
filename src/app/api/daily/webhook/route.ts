import { runSessionCompletion } from "@/lib/session-completion";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function extractRoomName(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const direct = o.room;
  if (typeof direct === "string" && direct.startsWith("frame-")) return direct;
  if (direct && typeof direct === "object") {
    const n = (direct as { name?: string }).name;
    if (typeof n === "string" && n.startsWith("frame-")) return n;
  }

  const payload = o.payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const pr = p.room;
    if (typeof pr === "string" && pr.startsWith("frame-")) return pr;
    if (pr && typeof pr === "object") {
      const n = (pr as { name?: string }).name;
      if (typeof n === "string" && n.startsWith("frame-")) return n;
    }
  }

  const roomName = o.room_name;
  if (typeof roomName === "string" && roomName.startsWith("frame-")) {
    return roomName;
  }

  return null;
}

/**
 * Daily.co webhooks — verify with DAILY_WEBHOOK_SECRET when configured.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const obj = payload as Record<string, unknown>;
  const eventType = String(obj.type ?? obj.event ?? "");

  if (!eventType.toLowerCase().includes("meeting.ended")) {
    return NextResponse.json({ received: true });
  }

  const roomName = extractRoomName(payload);
  if (!roomName) {
    return NextResponse.json({ received: true });
  }

  const bookingId = roomName.slice("frame-".length);
  if (!bookingId) {
    return NextResponse.json({ received: true });
  }

  const result = await runSessionCompletion({
    bookingId,
    fromDailyWebhook: true,
  });

  if (!result.ok) {
    console.error("daily webhook completion", result.error);
  }

  return NextResponse.json({ received: true });
}
