import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CloseBody = {
  bookingId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CloseBody;
  try {
    body = (await request.json()) as CloseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId =
    typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, expert_user_id, session_type, messaging_closed_at, messaging_closure_requested_at, status",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.expert_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (booking.messaging_closed_at != null) {
    return NextResponse.json(
      { error: "Thread is already closed" },
      { status: 400 },
    );
  }

  if (booking.status !== "confirmed" && booking.status !== "in_progress") {
    return NextResponse.json(
      { error: "Booking is not eligible for closure request" },
      { status: 400 },
    );
  }

  if (booking.messaging_closure_requested_at != null) {
    return NextResponse.json(
      { ok: true, status: "closure_requested" },
      { status: 200 },
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("bookings")
    .update({
      messaging_closure_requested_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("expert_user_id", user.id)
    .is("messaging_closed_at", null)
    .in("status", ["confirmed", "in_progress"])
    .select("id")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json(
      { error: "Could not request closure" },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Could not request closure" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, status: "closure_requested" });
}
