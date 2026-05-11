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
    .select("id, stripe_payment_intent_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pi = (booking.stripe_payment_intent_id as string | null)?.trim() || "";
  if (!pi) {
    return NextResponse.json({ error: "No payment intent" }, { status: 400 });
  }

  try {
    await stripe.refunds.create(
      { payment_intent: pi },
      { idempotencyKey: `admin-s9x2k-force-refund-${bookingId}` },
    );
  } catch (e) {
    console.error("admin force refund", e);
    return NextResponse.json({ error: "Refund could not be processed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
