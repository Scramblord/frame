import { PLATFORM_FEE_RATE, platformFeeFromTotal } from "@/lib/booking-pricing";

export type CancelledBy = "consumer" | "expert";

export type CancellationPolicy = {
  refundPercent: number;
};

export type RefundBreakdownPence = {
  consumerRefundPence: number;
  expertPayoutRetainedPence: number;
  frameFeeRetainedPence: number;
};

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function msUntilScheduled(scheduledAt: Date, now: Date): number | null {
  return scheduledAt.getTime() - now.getTime();
}

/**
 * Business rules for who gets what share of the gross when a consumer cancels.
 * Expert cancel always uses refundPercent 100 (full refund to consumer).
 */
export function getCancellationPolicy(
  scheduledAt: Date | null,
  now: Date,
  cancelledBy: CancelledBy,
): CancellationPolicy {
  if (cancelledBy === "expert") {
    return { refundPercent: 100 };
  }

  if (scheduledAt == null) {
    return { refundPercent: 100 };
  }

  const until = msUntilScheduled(scheduledAt, now);
  if (until == null || Number.isNaN(until)) {
    return { refundPercent: 100 };
  }

  if (until > MS_DAY) {
    return { refundPercent: 100 };
  }
  if (until >= MS_HOUR) {
    return { refundPercent: 75 };
  }
  return { refundPercent: 0 };
}

/**
 * Converts policy + amounts into integer pence for Stripe and accounting.
 * `totalAmountGbp` is the gross charged to the consumer; `platformFeeGbp` is FRAME's 5%.
 */
export function calculateRefundAmount(
  totalAmountGbp: number,
  platformFeeGbp: number,
  refundPercent: number,
  cancelledBy: CancelledBy,
): RefundBreakdownPence {
  const totalPence = Math.round(totalAmountGbp * 100);
  const platformPence = Math.max(0, Math.round(platformFeeGbp * 100));

  if (cancelledBy === "expert") {
    return {
      consumerRefundPence: totalPence,
      expertPayoutRetainedPence: 0,
      frameFeeRetainedPence: 0,
    };
  }

  if (refundPercent >= 100) {
    return {
      consumerRefundPence: totalPence,
      expertPayoutRetainedPence: 0,
      frameFeeRetainedPence: 0,
    };
  }

  if (refundPercent <= 0) {
    return {
      consumerRefundPence: 0,
      expertPayoutRetainedPence: Math.max(0, totalPence - platformPence),
      frameFeeRetainedPence: platformPence,
    };
  }

  const consumerRefundPence = Math.round((totalPence * refundPercent) / 100);
  const frameFeeRetainedPence = platformPence;
  const expertPayoutRetainedPence = Math.max(
    0,
    totalPence - consumerRefundPence - frameFeeRetainedPence,
  );

  return {
    consumerRefundPence,
    expertPayoutRetainedPence,
    frameFeeRetainedPence,
  };
}

export function gbpFromPence(pence: number): number {
  return Math.round(pence) / 100;
}

export function resolvePlatformFeeGbp(
  totalAmountGbp: number,
  platformFeeGbp: number | string | null | undefined,
): number {
  if (platformFeeGbp != null && platformFeeGbp !== "") {
    const n = Number(platformFeeGbp);
    if (Number.isFinite(n)) return n;
  }
  return platformFeeFromTotal(totalAmountGbp);
}

/** Reliability % for display; requires at least `minSessions` booked sessions. */
export function reliabilityPercent(
  sessionsKept: number,
  sessionsTotal: number,
  minSessions = 3,
): number | null {
  if (sessionsTotal < minSessions || sessionsTotal <= 0) return null;
  const pct = (sessionsKept / sessionsTotal) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function consumerCancelModalExplanation(params: {
  scheduledAt: Date | null;
  now: Date;
  refundGbp: number;
  pendingPayment: boolean;
}): string {
  const { scheduledAt, now, refundGbp, pendingPayment } = params;
  if (pendingPayment) {
    return "No payment has been taken yet. This booking will be cancelled.";
  }
  const policy = getCancellationPolicy(scheduledAt, now, "consumer");
  const formatted = formatGbpUk(refundGbp);

  if (policy.refundPercent <= 0) {
    return "Since your session is less than 1 hour away, no refund will be issued.";
  }
  if (policy.refundPercent >= 100) {
    if (scheduledAt == null) {
      return `You will receive a full refund of ${formatted}.`;
    }
    const until = scheduledAt.getTime() - now.getTime();
    if (until > MS_DAY) {
      return `Since your session is more than 24 hours away, you will receive a full refund of ${formatted}.`;
    }
    return `You will receive a full refund of ${formatted}.`;
  }
  return `Since your session is between 1 and 24 hours away, you will receive a 75% refund of ${formatted}.`;
}

export function expertCancelModalExplanation(
  refundGbp: number,
  pendingPayment: boolean,
): string {
  if (pendingPayment) {
    return "No payment has been taken yet. This booking will be cancelled.";
  }
  const formatted = formatGbpUk(refundGbp);
  return `Cancelling will issue a full refund to the consumer (${formatted}).`;
}

function formatGbpUk(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}
