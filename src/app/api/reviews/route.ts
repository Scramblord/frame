import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type PostBody = {
  booking_id?: string;
  rating?: number;
  comment?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
  const ratingRaw: unknown = body.rating;
  const commentRaw = body.comment;

  if (!bookingId) {
    return NextResponse.json({ error: "booking_id is required" }, { status: 400 });
  }

  let rating: number;
  if (typeof ratingRaw === "number" && Number.isInteger(ratingRaw)) {
    rating = ratingRaw;
  } else if (typeof ratingRaw === "string") {
    const s = ratingRaw.trim();
    rating = /^\d+$/.test(s) ? Number.parseInt(s, 10) : NaN;
  } else {
    rating = NaN;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be an integer between 1 and 5" },
      { status: 400 },
    );
  }

  let comment: string | null = null;
  if (commentRaw != null) {
    if (typeof commentRaw !== "string") {
      return NextResponse.json({ error: "comment must be a string" }, { status: 400 });
    }
    const t = commentRaw.trim();
    comment = t.length > 0 ? t : null;
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, consumer_user_id, expert_user_id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "completed") {
    return NextResponse.json(
      { error: "Reviews are only allowed for completed bookings" },
      { status: 400 },
    );
  }

  const isConsumer = booking.consumer_user_id === user.id;
  const isExpert = booking.expert_user_id === user.id;
  if (!isConsumer && !isExpert) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revieweeId = isConsumer ? booking.expert_user_id : booking.consumer_user_id;

  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You have already submitted a review for this booking" },
      { status: 409 },
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from("reviews")
    .insert({
      booking_id: bookingId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    })
    .select(
      "id, booking_id, reviewer_id, reviewee_id, rating, comment, created_at",
    )
    .single();

  if (insertErr || !inserted) {
    console.error("Review insert failed", insertErr);
    return NextResponse.json({ error: "Could not save review" }, { status: 500 });
  }

  const patch =
    isConsumer
      ? { consumer_reviewed: true }
      : { expert_reviewed: true };

  const { error: updErr } = await admin
    .from("bookings")
    .update(patch)
    .eq("id", bookingId);

  if (updErr) {
    console.error("Booking review flags update failed", updErr);
    return NextResponse.json(
      { error: "Review saved but booking could not be updated" },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: inserted });
}
