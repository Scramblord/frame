import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SessionCompletionResult } from "@/lib/session-completion";

const TRANSFER_DELAY_MS = 20 * 60 * 1000;

/**
 * Completes a messaging booking after closure is confirmed:
 * closed metadata, completed status, and 20-minute payout delay
 * (same pattern as `completeSession`, without scheduled_at/duration checks).
 */
export async function completeMessagingSession(params: {
  bookingId: string;
}): Promise<SessionCompletionResult> {
  const admin = createServiceRoleClient();

  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select(
      "id, status, session_type, messaging_closed_at, total_amount, expert_stripe_account_id, consumer_user_id, expert_user_id",
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return { ok: false, error: "Booking not found" };
  }

  if (
    booking.session_type !== "messaging" &&
    booking.session_type !== "urgent_messaging"
  ) {
    return { ok: false, error: "Not a messaging booking" };
  }

  if (booking.status === "completed") {
    return { ok: true, duplicate: true };
  }

  if (booking.status !== "confirmed" && booking.status !== "in_progress") {
    return { ok: false, error: "Booking is not eligible for completion" };
  }

  if (booking.messaging_closed_at != null) {
    return { ok: false, error: "Thread already closed" };
  }

  const totalGbp = Number(booking.total_amount);
  if (!Number.isFinite(totalGbp) || totalGbp < 0) {
    return { ok: false, error: "Invalid booking amount" };
  }

  const destination = booking.expert_stripe_account_id?.trim() ?? "";
  const hasPayoutAccount = destination.length > 0;
  const stripeTransferStatus: "pending" | "not_applicable" =
    totalGbp > 0 && hasPayoutAccount ? "pending" : "not_applicable";

  const transferAfter = new Date(Date.now() + TRANSFER_DELAY_MS).toISOString();
  const completedAt = new Date().toISOString();
  const closedAt = completedAt;

  const { data: updatedRows, error: updErr } = await admin
    .from("bookings")
    .update({
      messaging_closed_at: closedAt,
      messaging_closed_by: "expert",
      messaging_closure_requested_at: null,
      status: "completed",
      completed_at: completedAt,
      transfer_after: transferAfter,
      stripe_transfer_status: stripeTransferStatus,
    })
    .eq("id", params.bookingId)
    .is("messaging_closed_at", null)
    .in("status", ["confirmed", "in_progress"])
    .select("id");

  if (updErr) {
    console.error("[frame:completeMessagingSession] update error", updErr);
    return { ok: false, error: "Could not update booking" };
  }

  if (!updatedRows?.length) {
    const { data: b2 } = await admin
      .from("bookings")
      .select("status, messaging_closed_at")
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
