import {
  calculateRefundAmount,
  consumerCancelModalExplanation,
  expertCancelModalExplanation,
  getCancellationPolicy,
  gbpFromPence,
  resolvePlatformFeeGbp,
  type CancelledBy,
} from "@/lib/cancellation";
import { bookingCancelled } from "@/lib/email-templates";
import { getUserEmail, sendEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

const CANCELLABLE_STATUSES = ["pending_payment", "confirmed"] as const;

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, status, scheduled_at, total_amount, platform_fee, stripe_payment_intent_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  let cancelledBy: CancelledBy;
  if (booking.consumer_user_id === user.id) {
    cancelledBy = "consumer";
  } else if (booking.expert_user_id === user.id) {
    cancelledBy = "expert";
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    !CANCELLABLE_STATUSES.includes(
      booking.status as (typeof CANCELLABLE_STATUSES)[number],
    )
  ) {
    return NextResponse.json(
      { error: "This booking cannot be cancelled" },
      { status: 400 },
    );
  }

  const now = new Date();
  const scheduledAt = booking.scheduled_at
    ? new Date(booking.scheduled_at)
    : null;
  const policy = getCancellationPolicy(scheduledAt, now, cancelledBy);

  const totalGbp = Number(booking.total_amount);
  if (!Number.isFinite(totalGbp) || totalGbp < 0) {
    return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
  }

  const totalPence = Math.round(totalGbp * 100);

  const platformFeeGbp = resolvePlatformFeeGbp(totalGbp, booking.platform_fee);

  const breakdown = calculateRefundAmount(
    totalGbp,
    platformFeeGbp,
    policy.refundPercent,
    cancelledBy,
  );

  const pendingPayment = booking.status === "pending_payment";
  const paymentIntentId = booking.stripe_payment_intent_id?.trim() || null;
  const shouldRefundStripe =
    !pendingPayment &&
    Boolean(paymentIntentId) &&
    breakdown.consumerRefundPence > 0;

  if (shouldRefundStripe && paymentIntentId) {
    try {
      const isFullRefund = breakdown.consumerRefundPence >= totalPence;
      if (isFullRefund) {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
        });
      } else {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: breakdown.consumerRefundPence,
        });
      }
    } catch (e) {
      console.error("Stripe refund failed", e);
      return NextResponse.json(
        { error: "Payment refund could not be processed. Try again or contact support." },
        { status: 502 },
      );
    }
  }

  const refundAmountGbp = gbpFromPence(breakdown.consumerRefundPence);
  const admin = createServiceRoleClient();

  const { data: updatedRows, error: updErr } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancelled_by: cancelledBy,
      refund_amount: refundAmountGbp,
    })
    .eq("id", bookingId)
    .in("status", [...CANCELLABLE_STATUSES])
    .select("id");

  if (updErr) {
    console.error("Booking cancel update failed", updErr);
    return NextResponse.json({ error: "Could not update booking" }, { status: 500 });
  }

  if (!updatedRows?.length) {
    return NextResponse.json(
      { error: "Booking was already updated" },
      { status: 409 },
    );
  }

  try {
    const recipientUserId =
      cancelledBy === "consumer"
        ? booking.expert_user_id
        : booking.consumer_user_id;
    const otherUserId =
      cancelledBy === "consumer"
        ? booking.consumer_user_id
        : booking.expert_user_id;

    void (async () => {
      const recipientEmail = await getUserEmail(recipientUserId);
      if (!recipientEmail) {
        return;
      }

      const [{ data: rp }, { data: op }, { data: svc }] = await Promise.all([
        admin.from("profiles").select("full_name").eq("user_id", recipientUserId).maybeSingle(),
        admin.from("profiles").select("full_name").eq("user_id", otherUserId).maybeSingle(),
        booking.service_id
          ? admin.from("services").select("name").eq("id", booking.service_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const recipientName =
        typeof rp?.full_name === "string" && rp.full_name.trim() !== ""
          ? rp.full_name.trim()
          : "there";
      const otherPartyName =
        typeof op?.full_name === "string" && op.full_name.trim() !== ""
          ? op.full_name.trim()
          : "the other party";
      const serviceName =
        typeof svc?.name === "string" && svc.name.trim() !== ""
          ? svc.name.trim()
          : "Service";

      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
      const bookingUrl =
        recipientUserId === booking.consumer_user_id
          ? `${base}/bookings/${bookingId}`
          : `${base}/expert/bookings/${bookingId}`;

      const includeRefundNotice =
        recipientUserId === booking.consumer_user_id && refundAmountGbp > 0;

      await sendEmail({
        to: recipientEmail,
        subject: "Booking cancelled",
        html: bookingCancelled({
          recipientName,
          otherPartyName,
          serviceName,
          scheduledAt: booking.scheduled_at,
          refundAmount: refundAmountGbp,
          bookingUrl,
          includeRefundNotice,
        }),
      });
    })().catch((e) => console.error("email error", e));
  } catch (e) {
    console.error("email error", e);
  }

  const { data: consumerProfile } = await admin
    .from("profiles")
    .select("consumer_cancellations, consumer_sessions_total")
    .eq("user_id", booking.consumer_user_id)
    .maybeSingle();

  const { data: expertProfile } = await admin
    .from("expert_profiles")
    .select("expert_cancellations, expert_sessions_total")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  if (cancelledBy === "consumer") {
    await admin
      .from("profiles")
      .update({
        consumer_cancellations: (consumerProfile?.consumer_cancellations ?? 0) + 1,
        consumer_sessions_total: (consumerProfile?.consumer_sessions_total ?? 0) + 1,
      })
      .eq("user_id", booking.consumer_user_id);

    await admin
      .from("expert_profiles")
      .update({
        expert_sessions_total: (expertProfile?.expert_sessions_total ?? 0) + 1,
      })
      .eq("user_id", booking.expert_user_id);
  } else {
    await admin
      .from("expert_profiles")
      .update({
        expert_cancellations: (expertProfile?.expert_cancellations ?? 0) + 1,
        expert_sessions_total: (expertProfile?.expert_sessions_total ?? 0) + 1,
      })
      .eq("user_id", booking.expert_user_id);

    await admin
      .from("profiles")
      .update({
        consumer_sessions_total: (consumerProfile?.consumer_sessions_total ?? 0) + 1,
      })
      .eq("user_id", booking.consumer_user_id);
  }

  const explanation =
    cancelledBy === "expert"
      ? expertCancelModalExplanation(refundAmountGbp, pendingPayment)
      : consumerCancelModalExplanation({
          scheduledAt,
          now,
          refundGbp: refundAmountGbp,
          pendingPayment,
        });

  return NextResponse.json({
    ok: true,
    refundAmountGbp,
    message: explanation,
  });
}
