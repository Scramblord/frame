"use client";

import { ReviewModal } from "@/components/ReviewModal";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function StarsDisplay({ rating }: { rating: number }) {
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${r} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${
            i <= r
              ? "fill-amber-400 text-amber-400"
              : "fill-zinc-200 text-zinc-200 dark:fill-zinc-600 dark:text-zinc-600"
          }`}
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L10 15.9 4.8 17.8l1-5.9L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export type BookingReviewSectionProps = {
  bookingId: string;
  reviewerRole: "consumer" | "expert";
  bookingStatus: string;
  /** True when this party has submitted their review (from bookings row). */
  reviewed: boolean;
  revieweeName: string;
  existingReview: { rating: number; comment: string | null } | null;
};

export function BookingReviewSection({
  bookingId,
  reviewerRole,
  bookingStatus,
  reviewed,
  revieweeName,
  existingReview,
}: BookingReviewSectionProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(
    () => bookingStatus === "completed" && !reviewed,
  );
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (reviewed) {
      setModalOpen(false);
      setManualOpen(false);
    }
  }, [reviewed]);

  useEffect(() => {
    setModalOpen(bookingStatus === "completed" && !reviewed);
    setManualOpen(false);
  }, [bookingId]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleModalComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setManualOpen(false);
  }, []);

  if (bookingStatus !== "completed") {
    return null;
  }

  if (reviewed) {
    if (existingReview) {
      return (
        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Your review
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StarsDisplay rating={existingReview.rating} />
          </div>
          {existingReview.comment ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {existingReview.comment}
            </p>
          ) : (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No written comment.
            </p>
          )}
        </section>
      );
    }
    return (
      <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your review
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Thanks — your feedback was saved.
        </p>
      </section>
    );
  }

  const showModal = modalOpen || manualOpen;

  return (
    <>
      <ReviewModal
        bookingId={bookingId}
        reviewerRole={reviewerRole}
        revieweeName={revieweeName}
        open={showModal}
        onClose={handleCloseModal}
        onComplete={handleModalComplete}
      />

      {!reviewed && !showModal ? (
        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Leave a review
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Share feedback about your experience with{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {revieweeName}
            </span>
            .
          </p>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Leave a review
          </button>
        </section>
      ) : null}
    </>
  );
}
