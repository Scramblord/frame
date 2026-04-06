import { platformFeeFromTotal } from "@/lib/booking-pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export type SessionCompletionResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; error: string };

/**
 * Idempotent session completion: Stripe transfer once, status → completed, reliability counters.
 * `fromDailyWebhook`: skip the 80%-elapsed check (Daily meeting ended).
 * `skipServerElapsedCheck`: skip the 80%-elapsed check for POST /api/session/complete — the client
 * timer uses end = scheduled_at + duration; server clock skew can make server time lag behind, so
 * requiring 80% elapsed on the server would reject valid timer-end completions.
 */
export async function runSessionCompletion(params: {
  bookingId: string;
  fromDailyWebhook: boolean;
  skipServerElapsedCheck?: boolean;
}): Promise<SessionCompletionResult> {
  const admin = createServiceRoleClient();

  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select(
      "id, status, scheduled_at, duration_minutes, total_amount, platform_fee, expert_stripe_account_id, stripe_transfer_id, consumer_user_id, expert_user_id",
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return { ok: false, error: "Booking not found" };
  }

  if (booking.status === "completed") {
    return { ok: true, duplicate: true };
  }

  if (booking.status !== "in_progress") {
    return {
      ok: false,
      error: "Booking is not in progress",
    };
  }

  if (!booking.scheduled_at || booking.duration_minutes == null) {
    return { ok: false, error: "Booking missing schedule" };
  }

  const start = new Date(booking.scheduled_at).getTime();
  const durMs = booking.duration_minutes * 60 * 1000;
  const now = Date.now();

  const skipElapsed =
    params.fromDailyWebhook ||
    params.skipServerElapsedCheck === true;

  if (!skipElapsed) {
    if (now < start + 0.8 * durMs) {
      return {
        ok: false,
        error: "Session not yet eligible for completion",
      };
    }
  }

  const totalGbp = Number(booking.total_amount);
  let platformGbp =
    booking.platform_fee != null && Number.isFinite(Number(booking.platform_fee))
      ? Number(booking.platform_fee)
      : platformFeeFromTotal(totalGbp);
  if (!Number.isFinite(totalGbp) || totalGbp <= 0) {
    return { ok: false, error: "Invalid booking amount" };
  }

  const expertCutGbp = Math.max(0, totalGbp - platformGbp);
  const transferPence = Math.round(expertCutGbp * 100);

  const destination = booking.expert_stripe_account_id?.trim();
  if (!destination) {
    return { ok: false, error: "Expert payout account missing on booking" };
  }

  let transferId = booking.stripe_transfer_id?.trim() ?? null;

  if (!transferId && transferPence > 0) {
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: transferPence,
          currency: "gbp",
          destination,
          transfer_group: `booking_${params.bookingId}`,
        },
        { idempotencyKey: `frame_booking_payout_${params.bookingId}` },
      );
      transferId = transfer.id;
    } catch (e) {
      console.error("Stripe transfer failed", e);
      return { ok: false, error: "Payout transfer failed" };
    }
  }

  const completedAt = new Date().toISOString();

  const { data: updatedRows, error: updErr } = await admin
    .from("bookings")
    .update({
      status: "completed",
      completed_at: completedAt,
      stripe_transfer_id: transferId,
    })
    .eq("id", params.bookingId)
    .eq("status", "in_progress")
    .select("id");

  if (updErr) {
    console.error("complete booking update", updErr);
    return { ok: false, error: "Could not update booking" };
  }

  if (!updatedRows?.length) {
    const { data: b2 } = await admin
      .from("bookings")
      .select("status")
      .eq("id", params.bookingId)
      .maybeSingle();
    if (b2?.status === "completed") {
      return { ok: true, duplicate: true };
    }
    return { ok: false, error: "Could not complete booking" };
  }

  const { data: consumerProf } = await admin
    .from("profiles")
    .select("consumer_sessions_kept, consumer_sessions_total")
    .eq("user_id", booking.consumer_user_id)
    .maybeSingle();

  const { data: expertProf } = await admin
    .from("expert_profiles")
    .select("expert_sessions_kept, expert_sessions_total")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({
      consumer_sessions_kept: (consumerProf?.consumer_sessions_kept ?? 0) + 1,
      consumer_sessions_total: (consumerProf?.consumer_sessions_total ?? 0) + 1,
    })
    .eq("user_id", booking.consumer_user_id);

  await admin
    .from("expert_profiles")
    .update({
      expert_sessions_kept: (expertProf?.expert_sessions_kept ?? 0) + 1,
      expert_sessions_total: (expertProf?.expert_sessions_total ?? 0) + 1,
    })
    .eq("user_id", booking.expert_user_id);

  return { ok: true };
}
