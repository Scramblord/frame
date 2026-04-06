import {
  createMeetingToken,
  sessionRoomExpiryUnix,
} from "@/lib/daily";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function roomNameForBooking(bookingId: string) {
  return `frame-${bookingId}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bookingId = "";
  try {
    const json = (await request.json()) as { bookingId?: string };
    bookingId = json.bookingId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, status, session_type, scheduled_at, duration_minutes, daily_room_url",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (
    booking.consumer_user_id !== user.id &&
    booking.expert_user_id !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "in_progress" && booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Session is not active" },
      { status: 400 },
    );
  }

  if (booking.session_type !== "audio" && booking.session_type !== "video") {
    return NextResponse.json(
      { error: "This session type does not use a video room" },
      { status: 400 },
    );
  }

  if (!booking.scheduled_at || booking.duration_minutes == null) {
    return NextResponse.json(
      { error: "Booking missing schedule" },
      { status: 400 },
    );
  }

  const roomUrl = booking.daily_room_url?.trim();
  if (!roomUrl) {
    return NextResponse.json(
      { error: "Room not created yet — call create-room first" },
      { status: 400 },
    );
  }

  const isExpert = booking.expert_user_id === user.id;

  const [{ data: consumerP }, { data: expertP }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", booking.consumer_user_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", booking.expert_user_id)
      .maybeSingle(),
  ]);

  const participantName = isExpert
    ? expertP?.full_name?.trim() || "Expert"
    : consumerP?.full_name?.trim() || "Guest";
  const otherParticipantName = isExpert
    ? consumerP?.full_name?.trim() || "Guest"
    : expertP?.full_name?.trim() || "Expert";

  const scheduledAt = new Date(booking.scheduled_at);
  const expUnix = sessionRoomExpiryUnix(scheduledAt, booking.duration_minutes);
  const roomName = roomNameForBooking(booking.id);

  const tokenRes = await createMeetingToken({
    roomName,
    participantName,
    isOwner: isExpert,
    expUnix,
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokenRes.error }, { status: 502 });
  }

  return NextResponse.json({
    token: tokenRes.token,
    roomUrl,
    roomName,
    participantName,
    otherParticipantName,
    isOwner: isExpert,
    durationMinutes: booking.duration_minutes,
    scheduledAt: booking.scheduled_at,
  });
}
