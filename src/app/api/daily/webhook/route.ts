import { completeSession } from "@/lib/session-completion";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDailyVerificationPing(rawBody: string): boolean {
  const normalized = rawBody.replace(/\uFEFF/g, "").trim();
  if (!normalized) return false;

  // Fast-path: Daily verification probe payload is documented as {"test":true}.
  if (/"test"\s*:\s*true/i.test(normalized)) return true;

  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    return (
      parsed?.test === true ||
      parsed?.test === "true" ||
      parsed?.test === 1 ||
      parsed?.type === "test"
    );
  } catch {
    return false;
  }
}

/**
 * Required env:
 * - DAILY_WEBHOOK_SECRET: Daily webhook HMAC secret (base64-encoded key)
 * - Production webhook URL: https://<your-production-domain>/api/daily/webhook
 */

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
 * Daily.co webhooks with signature verification.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  console.log("[frame:daily-webhook] debug raw request", {
    rawBody,
    isDailyVerificationPing: isDailyVerificationPing(rawBody),
    rawBodyLength: rawBody.length,
  });

  if (isDailyVerificationPing(rawBody)) {
    return NextResponse.json({ received: true });
  }

  const signatureHeader = request.headers.get("x-webhook-signature");

  const secret = process.env.DAILY_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    console.error("[frame:daily-webhook] verification failed", {
      verification: "failed",
      reason: "missing DAILY_WEBHOOK_SECRET",
      eventType: "unknown",
      bookingId: null,
    });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!signatureHeader) {
    console.warn("[frame:daily-webhook] verification failed", {
      verification: "failed",
      reason: "missing x-webhook-signature header",
      eventType: "unknown",
      bookingId: null,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedSignature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const key = Buffer.from(secret, "base64");
  if (key.length === 0) {
    console.error("[frame:daily-webhook] verification failed", {
      verification: "failed",
      reason: "invalid DAILY_WEBHOOK_SECRET",
      eventType: "unknown",
      bookingId: null,
    });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", key)
    .update(rawBody, "utf8")
    .digest("base64");

  const got = Buffer.from(normalizedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  const signatureValid =
    got.length === expected.length && crypto.timingSafeEqual(got, expected);

  if (!signatureValid) {
    console.warn("[frame:daily-webhook] verification failed", {
      verification: "failed",
      reason: "signature mismatch",
      eventType: "unknown",
      bookingId: null,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const obj = payload as Record<string, unknown>;
  const eventType = String(obj.type ?? obj.event ?? "");
  console.log("[frame:daily-webhook] verification passed", {
    verification: "passed",
    eventType,
    bookingId: null,
  });

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

  console.log("[frame:daily-webhook] processing completion event", {
    verification: "passed",
    eventType,
    bookingId,
  });

  const result = await completeSession({
    bookingId,
    fromDailyWebhook: true,
  });

  if (!result.ok) {
    console.error("daily webhook completion", result.error);
  }

  return NextResponse.json({ received: true });
}
