"use client";

import {
  calculateRefundAmount,
  consumerCancelModalExplanation,
  expertCancelModalExplanation,
  getCancellationPolicy,
  gbpFromPence,
  resolvePlatformFeeGbp,
} from "@/lib/cancellation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  bookingId: string;
  variant: "consumer" | "expert";
  scheduledAt: string | null;
  totalAmountGbp: number;
  platformFeeGbp: number | null;
  pendingPayment: boolean;
  canCancel: boolean;
};

export function BookingCancelDialog({
  bookingId,
  variant,
  scheduledAt,
  totalAmountGbp,
  platformFeeGbp,
  pendingPayment,
  canCancel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewNow, setPreviewNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    refundAmountGbp: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) setPreviewNow(new Date());
  }, [open]);

  const preview = useMemo(() => {
    const scheduled = scheduledAt ? new Date(scheduledAt) : null;
    const cancelledBy = variant === "expert" ? "expert" : "consumer";
    const policy = getCancellationPolicy(scheduled, previewNow, cancelledBy);
    const pf = resolvePlatformFeeGbp(totalAmountGbp, platformFeeGbp);
    const breakdown = calculateRefundAmount(
      totalAmountGbp,
      pf,
      policy.refundPercent,
      cancelledBy,
    );
    const refundGbp = gbpFromPence(breakdown.consumerRefundPence);
    const text =
      variant === "expert"
        ? expertCancelModalExplanation(refundGbp, pendingPayment)
        : consumerCancelModalExplanation({
            scheduledAt: scheduled,
            now: previewNow,
            refundGbp,
            pendingPayment,
          });
    return { text, refundGbp };
  }, [
    scheduledAt,
    previewNow,
    variant,
    totalAmountGbp,
    platformFeeGbp,
    pendingPayment,
  ]);

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Booking cancelled</p>
        <p className="mt-1">{success.message}</p>
      </div>
    );
  }

  if (!canCancel) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-zinc-800 dark:text-rose-200 dark:hover:bg-rose-950/40"
      >
        Cancel booking
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2
              id="cancel-booking-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Cancel this booking?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {preview.text}
            </p>
            {error ? (
              <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
                      method: "POST",
                    });
                    const data = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      refundAmountGbp?: number;
                      message?: string;
                    };
                    if (!res.ok) {
                      setError(data.error ?? "Could not cancel booking");
                      return;
                    }
                    setSuccess({
                      refundAmountGbp: Number(data.refundAmountGbp ?? 0),
                      message: data.message ?? "Your booking has been cancelled.",
                    });
                    setOpen(false);
                    router.refresh();
                  } finally {
                    setLoading(false);
                  }
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading ? "Cancelling…" : "Confirm cancellation"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                Keep my booking
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
