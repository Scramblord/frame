import { requireAdminApi } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: bookingId } = await params;
  const admin = createServiceRoleClient();

  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select("id, status, stripe_payment_intent_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  const pi = (booking.stripe_payment_intent_id as string | null)?.trim() || "";
  if (pi) {
    try {
      await stripe.refunds.create(
        { payment_intent: pi },
        { idempotencyKey: `admin-s9x2k-force-cancel-${bookingId}` },
      );
    } catch (e) {
      console.error("admin force cancel refund", e);
      return NextResponse.json({ error: "Refund could not be processed" }, { status: 502 });
    }
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: nowIso,
      cancelled_by: null,
    })
    .eq("id", bookingId);

  if (updErr) {
    console.error("admin force cancel update", updErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
