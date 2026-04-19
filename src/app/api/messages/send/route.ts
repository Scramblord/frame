import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 20000;
const MESSAGE_CAP = 15;

type SendBody = {
  bookingId?: string;
  content?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId =
    typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  const contentRaw = typeof body.content === "string" ? body.content : "";

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const content = contentRaw.trim();
  if (content.length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "content is too long" }, { status: 400 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, session_type, status, service_id, messaging_closed_at, messaging_message_count, messaging_first_reply_at",
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

  if (
    booking.session_type !== "messaging" &&
    booking.session_type !== "urgent_messaging"
  ) {
    return NextResponse.json(
      { error: "This booking is not a messaging session" },
      { status: 400 },
    );
  }

  if (booking.status !== "confirmed" && booking.status !== "in_progress") {
    return NextResponse.json(
      { error: "Messaging is not active for this booking" },
      { status: 400 },
    );
  }

  if (booking.messaging_closed_at != null) {
    return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
  }

  const currentCount = Number(booking.messaging_message_count ?? 0);
  if (!Number.isFinite(currentCount) || currentCount >= MESSAGE_CAP) {
    return NextResponse.json({ error: "Message limit reached" }, { status: 400 });
  }

  const senderRole: "consumer" | "expert" =
    user.id === booking.consumer_user_id ? "consumer" : "expert";

  const { count: existingMsgCount, error: countErr } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId);

  if (countErr) {
    console.error("[frame:messages/send] count error", countErr);
    return NextResponse.json({ error: "Could not verify thread" }, { status: 500 });
  }

  const isFirstMessage = (existingMsgCount ?? 0) === 0;

  if (isFirstMessage && senderRole !== "consumer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      booking_id: bookingId,
      content,
      sender_id: user.id,
      sender_role: senderRole,
    })
    .select("id, booking_id, sender_id, content, created_at, sender_role")
    .single();

  if (insErr || !inserted) {
    console.error("[frame:messages/send] insert error", insErr);
    return NextResponse.json({ error: "Could not send message" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  if (isFirstMessage) {
    let deadlineIso: string;
    if (booking.session_type === "urgent_messaging") {
      deadlineIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else {
      const { data: service, error: svcErr } = await supabase
        .from("services")
        .select("messaging_response_hours")
        .eq("id", booking.service_id)
        .maybeSingle();

      if (svcErr) {
        console.error("[frame:messages/send] service fetch error", svcErr);
        return NextResponse.json(
          { error: "Could not load service settings" },
          { status: 500 },
        );
      }

      const hoursRaw = service?.messaging_response_hours;
      const hours =
        typeof hoursRaw === "number" && Number.isFinite(hoursRaw) && hoursRaw > 0
          ? hoursRaw
          : 24;
      deadlineIso = new Date(
        Date.now() + hours * 60 * 60 * 1000,
      ).toISOString();
    }

    const { error: openErr } = await supabase
      .from("bookings")
      .update({
        messaging_opened_at: nowIso,
        status: "in_progress",
        messaging_sla_deadline: deadlineIso,
      })
      .eq("id", bookingId)
      .eq("consumer_user_id", user.id);

    if (openErr) {
      console.error("[frame:messages/send] open thread update error", openErr);
      return NextResponse.json(
        { error: "Could not open messaging thread" },
        { status: 500 },
      );
    }
  }

  if (
    senderRole === "expert" &&
    booking.messaging_first_reply_at == null
  ) {
    const { error: replyErr } = await supabase
      .from("bookings")
      .update({ messaging_first_reply_at: nowIso })
      .eq("id", bookingId)
      .eq("expert_user_id", user.id);

    if (replyErr) {
      console.error("[frame:messages/send] first reply update error", replyErr);
      return NextResponse.json(
        { error: "Could not record first reply" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(inserted);
}
