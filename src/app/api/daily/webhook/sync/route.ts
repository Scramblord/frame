import { ensureDailyWebhookSubscription } from "@/lib/daily";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  console.log("[frame:daily-webhook-sync] request received");
  const secret = process.env.DAILY_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    console.error("[frame:daily-webhook-sync] missing DAILY_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const syncSecret = process.env.DAILY_WEBHOOK_SYNC_SECRET?.trim() ?? "";
  if (!syncSecret) {
    console.error("[frame:daily-webhook-sync] missing DAILY_WEBHOOK_SYNC_SECRET");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const got = request.headers.get("x-sync-secret")?.trim() ?? "";
  if (!got || got !== syncSecret) {
    console.warn("[frame:daily-webhook-sync] unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (!siteUrl) {
    console.error("[frame:daily-webhook-sync] missing NEXT_PUBLIC_SITE_URL");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const endpoint = `${siteUrl.replace(/\/+$/, "")}/api/daily/webhook`;
  console.log("[frame:daily-webhook-sync] ensuring webhook subscription", {
    endpoint,
  });
  const result = await ensureDailyWebhookSubscription({
    endpoint,
    secret,
  });

  if (!result.ok) {
    console.error("[frame:daily-webhook-sync] failed", {
      endpoint,
      error: result.error,
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  console.log("[frame:daily-webhook-sync] success", {
    action: result.action,
    endpoint,
    webhookUuid: result.webhook.uuid,
  });

  return NextResponse.json({
    ok: true,
    action: result.action,
    endpoint,
    webhook: result.webhook,
  });
}
