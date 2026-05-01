import { completeMessagingSession } from "@/lib/messaging-completion";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  bookingId?: string;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.PAYOUT_WORKER_SECRET?.trim() || "";
    const providedSecret =
      request.headers.get("x-payout-worker-secret")?.trim() || "";

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return unauthorized();
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const result = await completeMessagingSession({ bookingId });
    if (!result.ok) {
      if (result.error === "Booking not found") {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      if (
        result.error === "Not a messaging booking" ||
        result.error === "Booking is not eligible for completion" ||
        result.error === "Thread already closed"
      ) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (!result.duplicate) {
      const admin = createServiceRoleClient();
      await admin
        .from("bookings")
        .update({ messaging_closed_by: "system" })
        .eq("id", bookingId)
        .eq("status", "completed")
        .not("messaging_closed_at", "is", null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[frame:messages/inactivity-close] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
