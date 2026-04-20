import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId")?.trim() ?? "";
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, messaging_message_count, messaging_closed_at, messaging_closure_requested_at, messaging_sla_deadline, messaging_first_reply_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (
    booking.consumer_user_id !== user.id &&
    booking.expert_user_id !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, booking_id, sender_id, content, created_at, sender_role")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (msgErr) {
    console.error("[frame:messages/thread] messages error", msgErr);
    return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
  }

  return NextResponse.json({
    messages: messages ?? [],
    booking: {
      messaging_message_count: booking.messaging_message_count,
      messaging_closed_at: booking.messaging_closed_at,
      messaging_closure_requested_at: booking.messaging_closure_requested_at,
      messaging_sla_deadline: booking.messaging_sla_deadline,
      messaging_first_reply_at: booking.messaging_first_reply_at,
    },
  });
}
