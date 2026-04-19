import { completeMessagingSession } from "@/lib/messaging-completion";
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
      "id, expert_user_id, session_type, messaging_closed_at, status",
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

  const result = await completeMessagingSession({
    bookingId,
    expertUserId: user.id,
  });

  if (!result.ok) {
    if (result.error === "Thread already closed") {
      return NextResponse.json(
        { error: "Thread is already closed" },
        { status: 400 },
      );
    }
    if (result.error === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.error === "Booking not found") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const status =
      result.error === "Booking is not eligible for completion" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
