import { platformFeeFromTotal } from "@/lib/booking-pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export type SessionCompletionResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; error: string };

export type ProcessPayoutResult =
  | { outcome: "succeeded" }
  | { outcome: "failed"; terminal: boolean }
  | { outcome: "skipped"; reason: string }
  | { outcome: "error"; message: string };

function formatStripeError(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) {
      return o.message;
    }
    const type = o.type;
    const code = o.code;
    if (typeof type === "string" || typeof code === "string") {
      return [type, code, o.message].filter(Boolean).join(" ");
    }
  }
  return e instanceof Error ? e.message : String(e);
}

const TRANSFER_DELAY_MS = 20 * 60 * 1000;

/**
 * Idempotent session completion (request path): status → completed, schedule payout, profile counters.
 * Does not call Stripe — see `processBookingPayout`.
 *
 * `fromDailyWebhook`: skip the 80%-elapsed check (Daily meeting ended).
 * `skipServerElapsedCheck`: skip the 80%-elapsed check for POST /api/session/complete — client timer
 * uses scheduled_at + duration; server clock skew can otherwise reject valid completions.
 */
export async function completeSession(params: {
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
    console.log("[frame:completeSession] booking not found", {
      bookingId: params.bookingId,
      fetchErr,
    });
    return { ok: false, error: "Booking not found" };
  }

  if (booking.status === "completed") {
    console.log("[frame:completeSession] duplicate — already completed", {
      bookingId: params.bookingId,
    });
    return { ok: true, duplicate: true };
  }

  if (booking.status !== "in_progress") {
    console.log("[frame:completeSession] not in progress", {
      bookingId: params.bookingId,
      status: booking.status,
    });
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
    params.fromDailyWebhook || params.skipServerElapsedCheck === true;

  if (!skipElapsed) {
    if (now < start + 0.8 * durMs) {
      console.log("[frame:completeSession] not yet 80% elapsed", {
        bookingId: params.bookingId,
      });
      return {
        ok: false,
        error: "Session not yet eligible for completion",
      };
    }
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

  console.log("[frame:completeSession] updating booking to completed", {
    bookingId: params.bookingId,
    stripeTransferStatus,
    transferAfter,
    totalGbp,
    hasPayoutAccount,
  });

  const { data: updatedRows, error: updErr } = await admin
    .from("bookings")
    .update({
      status: "completed",
      completed_at: completedAt,
      transfer_after: transferAfter,
      stripe_transfer_status: stripeTransferStatus,
    })
    .eq("id", params.bookingId)
    .eq("status", "in_progress")
    .select("id");

  if (updErr) {
    console.error("[frame:completeSession] update error", updErr);
    return { ok: false, error: "Could not update booking" };
  }

  if (!updatedRows?.length) {
    const { data: b2 } = await admin
      .from("bookings")
      .select("status")
      .eq("id", params.bookingId)
      .maybeSingle();
    if (b2?.status === "completed") {
      console.log("[frame:completeSession] race lost — already completed", {
        bookingId: params.bookingId,
      });
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

  console.log("[frame:completeSession] done", { bookingId: params.bookingId });
  return { ok: true };
}

/**
 * Worker-only: claim row (FOR UPDATE SKIP LOCKED via RPC), Stripe transfer, update status.
 * Idempotent Stripe: `frame_booking_payout_${bookingId}`.
 */
export async function processBookingPayout(
  bookingId: string,
): Promise<ProcessPayoutResult> {
  const admin = createServiceRoleClient();

  const { data: claimed, error: claimErr } = await admin.rpc(
    "claim_booking_for_payout",
    { p_booking_id: bookingId },
  );

  if (claimErr) {
    console.error("[frame:processBookingPayout] claim RPC error", {
      bookingId,
      claimErr,
    });
    return { outcome: "error", message: claimErr.message };
  }

  const row = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!row || typeof row !== "object") {
    console.log("[frame:processBookingPayout] skip — not claimed (no row)", {
      bookingId,
    });
    return { outcome: "skipped", reason: "not_eligible_or_locked" };
  }

  const booking = row as {
    id: string;
    total_amount: unknown;
    platform_fee: unknown;
    expert_stripe_account_id: string | null;
    stripe_transfer_id: string | null;
  };

  const totalGbp = Number(booking.total_amount);
  let platformGbp =
    booking.platform_fee != null && Number.isFinite(Number(booking.platform_fee))
      ? Number(booking.platform_fee)
      : platformFeeFromTotal(totalGbp);
  if (!Number.isFinite(totalGbp) || totalGbp < 0) {
    console.warn("[frame:processBookingPayout] invalid amount → not_applicable", {
      bookingId,
      totalGbp,
    });
    await admin
      .from("bookings")
      .update({ stripe_transfer_status: "not_applicable" })
      .eq("id", bookingId)
      .eq("stripe_transfer_status", "pending");
    return { outcome: "skipped", reason: "invalid_amount" };
  }

  const expertCutGbp = Math.max(0, totalGbp - platformGbp);
  const transferPence = Math.round(expertCutGbp * 100);
  const destination = booking.expert_stripe_account_id?.trim() ?? "";

  if (transferPence <= 0) {
    console.log("[frame:processBookingPayout] zero payout → not_applicable", {
      bookingId,
      transferPence,
    });
    await admin
      .from("bookings")
      .update({ stripe_transfer_status: "not_applicable" })
      .eq("id", bookingId)
      .eq("stripe_transfer_status", "pending");
    return { outcome: "succeeded" };
  }

  if (!destination) {
    console.warn(
      "[frame:processBookingPayout] no destination — marking not_applicable",
      { bookingId },
    );
    await admin
      .from("bookings")
      .update({
        stripe_transfer_status: "not_applicable",
        stripe_transfer_last_error:
          "Expert payout account missing on booking (legacy/inconsistent row)",
      })
      .eq("id", bookingId)
      .eq("stripe_transfer_status", "pending");
    return { outcome: "skipped", reason: "no_destination" };
  }

  try {
    console.log("[frame:processBookingPayout] Stripe transfer create", {
      bookingId,
      transferPence,
    });
    const transfer = await stripe.transfers.create(
      {
        amount: transferPence,
        currency: "gbp",
        destination,
        transfer_group: `booking_${bookingId}`,
      },
      { idempotencyKey: `frame_booking_payout_${bookingId}` },
    );

    const { error: upErr, data: upRows } = await admin
      .from("bookings")
      .update({
        stripe_transfer_id: transfer.id,
        stripe_transfer_status: "succeeded",
        stripe_transfer_last_error: null,
      })
      .eq("id", bookingId)
      .eq("stripe_transfer_status", "pending")
      .select("id");

    if (upErr) {
      console.error("[frame:processBookingPayout] success update failed", {
        bookingId,
        upErr,
      });
      return { outcome: "error", message: upErr.message };
    }

    if (!upRows?.length) {
      console.log(
        "[frame:processBookingPayout] success update 0 rows (already processed?)",
        { bookingId },
      );
    }

    console.log("[frame:processBookingPayout] succeeded", {
      bookingId,
      transferId: transfer.id,
    });
    return { outcome: "succeeded" };
  } catch (e) {
    const msg = formatStripeError(e);
    console.error("[frame:processBookingPayout] Stripe error", {
      bookingId,
      message: msg,
      raw: e,
    });

    const { data: failRows, error: failErr } = await admin.rpc(
      "apply_booking_payout_failure",
      {
        p_booking_id: bookingId,
        p_error: msg,
      },
    );

    if (failErr) {
      console.error("[frame:processBookingPayout] apply failure RPC error", {
        bookingId,
        failErr,
      });
      return { outcome: "error", message: failErr.message };
    }

    const failList = Array.isArray(failRows)
      ? failRows
      : failRows
        ? [failRows]
        : [];
    const fr = failList[0];
    if (!fr || typeof fr !== "object") {
      console.error(
        "[frame:processBookingPayout] apply failure returned no row",
        { bookingId },
      );
      return {
        outcome: "error",
        message: "Could not record payout failure",
      };
    }
    const newStatus =
      "new_status" in fr ? String((fr as { new_status: unknown }).new_status) : null;

    const terminal = newStatus === "failed";
    console.log("[frame:processBookingPayout] recorded failure", {
      bookingId,
      newStatus,
      terminal,
    });
    return { outcome: "failed", terminal };
  }
}

/** @deprecated Use `completeSession` — alias for backwards compatibility. */
export const runSessionCompletion = completeSession;
