import { createDailyRoom } from "@/lib/daily";
import { createServiceRoleClient } from "@/lib/supabase/admin";
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

  const canOpenRoom =
    booking.status === "confirmed" || booking.status === "in_progress";

  if (!canOpenRoom) {
    if (booking.status === "pending_payment") {
      return NextResponse.json(
        {
          error:
            "Payment is not confirmed yet. If you already paid, wait a few seconds and try again, or return from the booking page after payment completes.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Booking must be confirmed to start a session" },
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
      { error: "Booking must have a scheduled time and duration" },
      { status: 400 },
    );
  }

  const roomName = roomNameForBooking(booking.id);
  let resolvedRoomUrl =
    typeof booking.daily_room_url === "string"
      ? booking.daily_room_url.trim()
      : "";

  if (!resolvedRoomUrl) {
    const { data: urlRow } = await createServiceRoleClient()
      .from("bookings")
      .select("daily_room_url")
      .eq("id", bookingId)
      .maybeSingle();
    const snap = urlRow?.daily_room_url;
    if (typeof snap === "string" && snap.trim().length > 0) {
      resolvedRoomUrl = snap.trim();
    }
  }

  if (resolvedRoomUrl.length > 0) {
    const adminSync = createServiceRoleClient();
    await adminSync
      .from("bookings")
      .update({ status: "in_progress" })
      .eq("id", bookingId)
      .in("status", ["confirmed", "in_progress"]);
    return NextResponse.json({
      roomName,
      roomUrl: resolvedRoomUrl,
    });
  }

  const scheduledAt = new Date(booking.scheduled_at);
  const created = await createDailyRoom({
    bookingId: booking.id,
    scheduledAt,
    durationMinutes: booking.duration_minutes,
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: created.error },
      { status: 502 },
    );
  }

  const admin = createServiceRoleClient();
  const { data: updated, error: updErr } = await admin
    .from("bookings")
    .update({
      daily_room_url: created.roomUrl,
      status: "in_progress",
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");

  if (updErr) {
    console.error("create-room update", updErr);
    return NextResponse.json({ error: "Could not save room" }, { status: 500 });
  }

  if (!updated?.length) {
    const { data: again } = await supabase
      .from("bookings")
      .select("daily_room_url")
      .eq("id", bookingId)
      .maybeSingle();
    if (again?.daily_room_url) {
      return NextResponse.json({
        roomName,
        roomUrl: again.daily_room_url,
      });
    }
    return NextResponse.json(
      { error: "Booking state changed — try again" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    roomName: created.roomName,
    roomUrl: created.roomUrl,
  });
}
