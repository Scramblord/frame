import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
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

    const admin = createServiceRoleClient();
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select(
        "id, status, session_type, messaging_closed_at, total_amount, stripe_payment_intent_id, consumer_user_id, expert_user_id",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (
      booking.session_type !== "messaging" &&
      booking.session_type !== "urgent_messaging"
    ) {
      return NextResponse.json(
        { error: "This booking is not a messaging session" },
        { status: 400 },
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (booking.status !== "in_progress" || booking.messaging_closed_at != null) {
      return NextResponse.json(
        { error: "Booking is not eligible for SLA refund" },
        { status: 400 },
      );
    }

    const paymentIntentId = booking.stripe_payment_intent_id?.trim() || "";
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Missing payment intent for refund" },
        { status: 400 },
      );
    }

    try {
      await stripe.refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `sla-breach-refund-${bookingId}` },
      );
    } catch (refundError) {
      console.error("[frame:messages/sla-refund] Stripe refund failed", refundError);
      return NextResponse.json(
        { error: "Could not process refund" },
        { status: 502 },
      );
    }

    const nowIso = new Date().toISOString();
    const { data: updatedRows, error: updateErr } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: nowIso,
        cancellation_reason: "sla_breach",
        messaging_closed_at: nowIso,
        messaging_closed_by: "system",
        stripe_transfer_status: "not_applicable",
      })
      .eq("id", bookingId)
      .eq("status", "in_progress")
      .is("messaging_closed_at", null)
      .select("id");

    if (updateErr) {
      console.error("[frame:messages/sla-refund] booking update failed", updateErr);
      return NextResponse.json({ error: "Could not update booking" }, { status: 500 });
    }

    if (!updatedRows?.length) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[frame:messages/sla-refund] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
