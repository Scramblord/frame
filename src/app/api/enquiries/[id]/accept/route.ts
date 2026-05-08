import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: enquiry, error: enquiryErr } = await supabase
    .from("enquiries")
    .select("id, consumer_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (enquiryErr || !enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  if (enquiry.consumer_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, status, offer_expires_at")
    .eq("source_enquiry_id", enquiry.id)
    .eq("status", "offer_pending")
    .order("offer_sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "No active offer found" }, { status: 404 });
  }

  const nowMs = Date.now();
  const expiryMs = booking.offer_expires_at
    ? new Date(booking.offer_expires_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date(nowMs).toISOString(),
      })
      .eq("id", booking.id)
      .eq("status", "offer_pending");
    await supabase
      .from("enquiries")
      .update({ status: "open" })
      .eq("id", enquiry.id)
      .eq("status", "offer_sent");
    return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from("bookings")
    .update({
      status: "pending_payment",
      offer_expires_at: null,
    })
    .eq("id", booking.id)
    .eq("status", "offer_pending")
    .eq("consumer_user_id", user.id)
    .select("id")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not accept offer" },
      { status: 500 },
    );
  }

  return NextResponse.json({ bookingId: updated.id });
}
