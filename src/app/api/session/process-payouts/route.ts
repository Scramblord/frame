import { processBookingPayout } from "@/lib/session-completion";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADER = "x-payout-worker-secret";

async function runProcessPayouts(): Promise<NextResponse> {
  const admin = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error: qErr } = await admin
    .from("bookings")
    .select("id")
    .eq("status", "completed")
    .eq("stripe_transfer_status", "pending")
    .lte("transfer_after", nowIso)
    .order("transfer_after", { ascending: true });

  if (qErr) {
    console.error("[frame:process-payouts] list query error", qErr);
    return NextResponse.json(
      { error: "Could not list pending payouts" },
      { status: 500 },
    );
  }

  const ids = (rows ?? []).map((r) => r.id as string);
  console.log("[frame:process-payouts] pending batch", {
    count: ids.length,
    ids,
  });

  let succeeded = 0;
  let failed = 0;
  let failedTerminal = 0;
  let skipped = 0;
  let errored = 0;

  for (const id of ids) {
    const result = await processBookingPayout(id);
    switch (result.outcome) {
      case "succeeded":
        succeeded += 1;
        break;
      case "failed":
        failed += 1;
        if (result.terminal) failedTerminal += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "error":
        errored += 1;
        break;
      default:
        break;
    }
  }

  const summary = {
    ok: true as const,
    processed: ids.length,
    succeeded,
    failed,
    failedTerminal,
    skipped,
    errored,
  };
  console.log("[frame:process-payouts] done", summary);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const secret = process.env.PAYOUT_WORKER_SECRET;
  if (!secret || secret.trim() === "") {
    console.error("[frame:process-payouts] PAYOUT_WORKER_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const got = request.headers.get(HEADER);
  if (got !== secret) {
    console.log("[frame:process-payouts] unauthorized — bad or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runProcessPayouts();
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[frame:process-payouts] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("Authorization");
  const token =
    auth != null && auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length).trim()
      : null;

  if (!token || token !== cronSecret) {
    console.log(
      "[frame:process-payouts] unauthorized — bad or missing Bearer token",
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[frame:process-payouts] run triggered by Vercel cron");
  return runProcessPayouts();
}
