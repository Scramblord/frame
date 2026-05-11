"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  canForceCancel: boolean;
  canForceRefund: boolean;
};

export function AdminBookingActions({ bookingId, canForceCancel, canForceRefund }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"cancel" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function post(path: "cancel" | "refund") {
    setLoading(path);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin-s9x2k/bookings/${bookingId}/${path}`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Request failed");
        setLoading(null);
        return;
      }
      setSuccess(path === "cancel" ? "Booking cancelled" : "Refund issued successfully");
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(null);
    }
  }

  const hasActions = canForceCancel || canForceRefund;
  if (!hasActions && !success && !error) {
    return null;
  }

  return (
    <div className="mt-6 space-y-3">
      {hasActions ? (
        <div className="flex flex-wrap gap-3">
          {canForceCancel ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void post("cancel")}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
            >
              {loading === "cancel" ? "Working…" : "Force cancel"}
            </button>
          ) : null}
          {canForceRefund ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void post("refund")}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {loading === "refund" ? "Working…" : "Force refund"}
            </button>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
          role="status"
        >
          {success}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
