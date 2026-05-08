import {
  platformFeeFromTotal,
  totalForBooking,
  type BookableSessionType,
} from "@/lib/booking-pricing";
import {
  applyDiscountToTotal,
  bestAutomaticDiscountForService,
  type DiscountRow,
} from "@/lib/discounts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type OfferBody = {
  sessionType?: BookableSessionType;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
};

function isSessionType(value: string): value is BookableSessionType {
  return (
    value === "messaging" ||
    value === "urgent_messaging" ||
    value === "audio" ||
    value === "video"
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OfferBody;
  try {
    body = (await request.json()) as OfferBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sessionType || !isSessionType(body.sessionType)) {
    return NextResponse.json({ error: "Invalid sessionType" }, { status: 400 });
  }

  const { data: enquiry, error: enquiryErr } = await supabase
    .from("enquiries")
    .select("id, consumer_user_id, expert_user_id, service_id, status")
    .eq("id", id)
    .maybeSingle();

  if (enquiryErr || !enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  if (enquiry.expert_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (enquiry.status !== "open" && enquiry.status !== "offer_sent") {
    return NextResponse.json(
      { error: "Enquiry is not open for offers" },
      { status: 400 },
    );
  }

  const { data: service, error: serviceErr } = await supabase
    .from("services")
    .select(
      "id, name, description, expert_user_id, is_active, booking_mode, offers_messaging, messaging_flat_rate, urgent_messaging_enabled, urgent_messaging_rate, offers_audio, audio_hourly_rate, offers_video, video_hourly_rate, min_session_minutes, max_session_minutes",
    )
    .eq("id", enquiry.service_id)
    .maybeSingle();

  if (serviceErr || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (service.expert_user_id !== user.id || service.booking_mode !== "flexible" || !service.is_active) {
    return NextResponse.json({ error: "Service is not offerable" }, { status: 400 });
  }

  let scheduledAt: string | null = null;
  let durationMinutes: number | null = null;
  if (body.sessionType === "audio" || body.sessionType === "video") {
    if (!body.scheduledAt || body.durationMinutes == null) {
      return NextResponse.json(
        { error: "scheduledAt and durationMinutes are required for audio/video offers" },
        { status: 400 },
      );
    }
    const parsedMs = new Date(body.scheduledAt).getTime();
    if (!Number.isFinite(parsedMs)) {
      return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
    }
    const minutes = Math.trunc(Number(body.durationMinutes));
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes % 15 !== 0) {
      return NextResponse.json(
        { error: "durationMinutes must be a positive 15-minute increment" },
        { status: 400 },
      );
    }
    if (minutes < service.min_session_minutes || minutes > service.max_session_minutes) {
      return NextResponse.json(
        { error: "durationMinutes is outside service limits" },
        { status: 400 },
      );
    }
    scheduledAt = new Date(parsedMs).toISOString();
    durationMinutes = minutes;
  }

  const baseTotal = totalForBooking(
    service as Parameters<typeof totalForBooking>[0],
    body.sessionType,
    durationMinutes,
  );
  if (baseTotal == null || !Number.isFinite(baseTotal) || baseTotal <= 0) {
    return NextResponse.json(
      { error: "Could not compute offer amount for this service/session type" },
      { status: 400 },
    );
  }

  const { data: discountRows } = await supabase
    .from("discounts")
    .select("*")
    .eq("expert_user_id", enquiry.expert_user_id)
    .eq("is_active", true)
    .is("code", null);
  const automaticDiscount = bestAutomaticDiscountForService(
    (discountRows ?? []) as DiscountRow[],
    enquiry.service_id,
    baseTotal,
  );
  const lockedTotal = automaticDiscount
    ? applyDiscountToTotal(baseTotal, automaticDiscount)
    : baseTotal;
  const platformFee = platformFeeFromTotal(lockedTotal);
  const now = Date.now();
  const offerSentAt = new Date(now).toISOString();
  const offerExpiresAt = new Date(now + 48 * 60 * 60 * 1000).toISOString();

  const { error: cancelPrevErr } = await admin
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: offerSentAt })
    .eq("source_enquiry_id", enquiry.id)
    .eq("status", "offer_pending");

  if (cancelPrevErr) {
    return NextResponse.json(
      { error: cancelPrevErr.message ?? "Could not replace previous offer" },
      { status: 500 },
    );
  }

  const { data: insertedBooking, error: insertBookingErr } = await admin
    .from("bookings")
    .insert({
      consumer_user_id: enquiry.consumer_user_id,
      expert_user_id: enquiry.expert_user_id,
      service_id: enquiry.service_id,
      session_type: body.sessionType,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      status: "offer_pending",
      total_amount: lockedTotal,
      platform_fee: platformFee,
      source_enquiry_id: enquiry.id,
      offer_sent_at: offerSentAt,
      offer_expires_at: offerExpiresAt,
    })
    .select(
      "id, session_type, scheduled_at, duration_minutes, total_amount, platform_fee, offer_sent_at, offer_expires_at",
    )
    .single();

  if (insertBookingErr || !insertedBooking) {
    return NextResponse.json(
      { error: insertBookingErr?.message ?? "Could not create booking offer" },
      { status: 500 },
    );
  }

  const { error: updateEnquiryErr } = await supabase
    .from("enquiries")
    .update({ status: "offer_sent" })
    .eq("id", enquiry.id);

  if (updateEnquiryErr) {
    return NextResponse.json(
      { error: updateEnquiryErr.message ?? "Could not update enquiry status" },
      { status: 500 },
    );
  }

  const offerMessagePayload = {
    type: "booking_offer",
    bookingId: insertedBooking.id,
    sessionType: insertedBooking.session_type,
    scheduledAt: insertedBooking.scheduled_at,
    durationMinutes: insertedBooking.duration_minutes,
    totalAmount: insertedBooking.total_amount,
    platformFee: insertedBooking.platform_fee,
    offerSentAt: insertedBooking.offer_sent_at,
    offerExpiresAt: insertedBooking.offer_expires_at,
  };

  const { error: messageErr } = await supabase.from("enquiry_messages").insert({
    enquiry_id: enquiry.id,
    sender_id: user.id,
    content: JSON.stringify(offerMessagePayload),
    is_offer: true,
  });

  if (messageErr) {
    return NextResponse.json(
      { error: messageErr.message ?? "Offer created but message failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    enquiryId: enquiry.id,
    booking: insertedBooking,
    discountApplied: automaticDiscount != null,
  });
}
