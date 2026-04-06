import {
  DEFAULT_EXPERT_TIMEZONE,
  expertWallDateTimeToUtc,
} from "@/lib/booking-time";
import {
  platformFeeFromTotal,
  totalForBooking,
  type BookableSessionType,
} from "@/lib/booking-pricing";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CreateBody = {
  expertProfileId: string;
  serviceId: string;
  sessionType: BookableSessionType;
  /** yyyy-MM-dd (audio/video) */
  scheduledDate: string | null;
  /** HH:mm (audio/video) */
  slotTime: string | null;
  durationMinutes: number | null;
};

function isSessionType(s: string): s is BookableSessionType {
  return (
    s === "messaging" ||
    s === "urgent_messaging" ||
    s === "audio" ||
    s === "video"
  );
}

type AvailRow = {
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

function timeToMinutes(t: string): number {
  const s = t.length >= 5 ? t.slice(0, 5) : t;
  const [h, m] = s.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function slotFitsAvailability(
  rows: unknown,
  slotHHmm: string,
  durationMinutes: number,
): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const slotM = timeToMinutes(slotHHmm);
  const endNeeded = slotM + durationMinutes;
  for (const raw of rows) {
    const r = raw as AvailRow;
    if (!r.is_available || r.start_time == null || r.end_time == null) {
      continue;
    }
    const a = timeToMinutes(String(r.start_time));
    const b = timeToMinutes(String(r.end_time));
    if (slotM >= a && endNeeded <= b) {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    expertProfileId,
    serviceId,
    sessionType: rawType,
    scheduledDate,
    slotTime,
    durationMinutes,
  } = body;

  if (
    !expertProfileId ||
    !serviceId ||
    !rawType ||
    !isSessionType(rawType)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sessionType = rawType;

  const { data: expertConsumerProfile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", expertProfileId)
    .maybeSingle();

  if (pErr || !expertConsumerProfile) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  const expertUserId = expertConsumerProfile.user_id;

  if (expertUserId === user.id) {
    return NextResponse.json(
      { error: "You cannot book your own services" },
      { status: 400 },
    );
  }

  const { data: service, error: sErr } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("expert_user_id", expertUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (sErr || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const { data: expertRow } = await supabase
    .from("expert_profiles")
    .select("timezone")
    .eq("user_id", expertUserId)
    .maybeSingle();

  const expertTz =
    (expertRow?.timezone as string | null)?.trim() || DEFAULT_EXPERT_TIMEZONE;

  let scheduledAt: string | null = null;
  let durationForRow: number | null = null;

  if (sessionType === "audio" || sessionType === "video") {
    if (!scheduledDate || !slotTime || durationMinutes == null) {
      return NextResponse.json(
        { error: "Date, time and duration are required for this session type" },
        { status: 400 },
      );
    }
    if (durationMinutes < service.min_session_minutes) {
      return NextResponse.json(
        { error: "Duration below minimum" },
        { status: 400 },
      );
    }
    if (durationMinutes > service.max_session_minutes) {
      return NextResponse.json(
        { error: "Duration above maximum" },
        { status: 400 },
      );
    }
    if (durationMinutes % 15 !== 0) {
      return NextResponse.json(
        { error: "Duration must be in 15-minute increments" },
        { status: 400 },
      );
    }

    const { data: availRows, error: availErr } = await supabase.rpc(
      "get_expert_availability_for_date",
      {
        p_expert_user_id: expertUserId,
        p_date: scheduledDate,
      },
    );

    if (availErr || !slotFitsAvailability(availRows, slotTime, durationMinutes)) {
      return NextResponse.json(
        { error: "That time is not available for this expert" },
        { status: 400 },
      );
    }

    const start = expertWallDateTimeToUtc(scheduledDate, slotTime, expertTz);
    scheduledAt = start.toISOString();
    durationForRow = durationMinutes;
  } else {
    scheduledAt = null;
    durationForRow = null;
  }

  const total = totalForBooking(service, sessionType, durationForRow);
  if (total == null || !Number.isFinite(total) || total <= 0) {
    return NextResponse.json(
      { error: "Invalid price for this session configuration" },
      { status: 400 },
    );
  }

  const platformFee = platformFeeFromTotal(total);

  const { data: inserted, error: insErr } = await supabase
    .from("bookings")
    .insert({
      consumer_user_id: user.id,
      expert_user_id: expertUserId,
      service_id: serviceId,
      session_type: sessionType,
      scheduled_at: scheduledAt,
      duration_minutes: durationForRow,
      status: "pending_payment",
      total_amount: total,
      platform_fee: platformFee,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error(insErr);
    return NextResponse.json(
      { error: "Could not create booking" },
      { status: 500 },
    );
  }

  return NextResponse.json({ bookingId: inserted.id });
}
