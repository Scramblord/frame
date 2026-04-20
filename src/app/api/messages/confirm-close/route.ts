import { completeMessagingSession } from "@/lib/messaging-completion";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConfirmCloseBody = {
  bookingId?: string;
  confirm?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ConfirmCloseBody;
  try {
    body = (await request.json()) as ConfirmCloseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId =
    typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }
  if (typeof body.confirm !== "boolean") {
    return NextResponse.json({ error: "confirm must be boolean" }, { status: 400 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, session_type, status, messaging_closed_at, messaging_closure_requested_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.consumer_user_id !== user.id) {
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

  if (booking.messaging_closed_at != null || booking.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  if (booking.messaging_closure_requested_at == null) {
    return NextResponse.json(
      { error: "No closure request is pending" },
      { status: 400 },
    );
  }

  if (!body.confirm) {
    const { error: updErr } = await supabase
      .from("bookings")
      .update({ messaging_closure_requested_at: null })
      .eq("id", bookingId)
      .eq("consumer_user_id", user.id)
      .is("messaging_closed_at", null);
    if (updErr) {
      return NextResponse.json(
        { error: "Could not update closure request" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const result = await completeMessagingSession({ bookingId });
  if (!result.ok) {
    if (result.error === "Booking not found") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (
      result.error === "Thread already closed" ||
      result.error === "Booking is not eligible for completion"
    ) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
