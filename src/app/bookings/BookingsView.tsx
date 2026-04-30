"use client";

import { ConsumerBookingCard, type ConsumerBookingCardProps } from "@/components/ConsumerBookingCard";
import {
  formatBookingDateTime,
  formatDurationMinutes,
  formatStatusLabel,
  sessionTypeIcon,
  sessionTypeLabel,
  statusBadgeStyles,
} from "@/lib/booking-display";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type FormatFilter = "all" | "video-audio" | "messaging";
type PastStatusFilter = "all" | "completed" | "cancelled" | "no_show";

type BookingsViewProps = {
  allBookings: ConsumerBookingCardProps[];
  isPast: boolean;
};

function isMessagingSession(sessionType: string): boolean {
  return sessionType === "messaging" || sessionType === "urgent_messaging";
}

function sortByScheduledAtAsc(items: ConsumerBookingCardProps[]): ConsumerBookingCardProps[] {
  return [...items].sort((a, b) => {
    const ta =
      a.scheduledAt != null
        ? new Date(a.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;
    const tb =
      b.scheduledAt != null
        ? new Date(b.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    return ta - tb;
  });
}

function sortByScheduledAtDesc(items: ConsumerBookingCardProps[]): ConsumerBookingCardProps[] {
  return [...items].sort((a, b) => {
    const ta =
      a.scheduledAt != null
        ? new Date(a.scheduledAt).getTime()
        : Number.NEGATIVE_INFINITY;
    const tb =
      b.scheduledAt != null
        ? new Date(b.scheduledAt).getTime()
        : Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    return tb - ta;
  });
}

export default function BookingsView({ allBookings, isPast }: BookingsViewProps) {
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [statusFilter, setStatusFilter] = useState<PastStatusFilter>("all");

  const filteredBookings = useMemo(() => {
    let list = allBookings;

    if (formatFilter === "video-audio") {
      list = list.filter((booking) => !isMessagingSession(booking.sessionType));
    } else if (formatFilter === "messaging") {
      list = list.filter((booking) => isMessagingSession(booking.sessionType));
    }

    if (isPast && statusFilter !== "all") {
      list = list.filter((booking) => booking.status === statusFilter);
    }

    return isPast ? sortByScheduledAtDesc(list) : sortByScheduledAtAsc(list);
  }, [allBookings, formatFilter, isPast, statusFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "all" as const, label: "All" },
          { id: "video-audio" as const, label: "Video & Audio" },
          { id: "messaging" as const, label: "Messaging" },
        ].map((pill) => {
          const active = formatFilter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFormatFilter(pill.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {isPast ? (
        <div className="mb-4">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PastStatusFilter)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-auto"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      ) : null}

      {filteredBookings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {isPast ? "No bookings match this filter." : "No bookings for this format yet."}
          </p>
        </div>
      ) : (
        <ul>
          {filteredBookings.map((booking) =>
            booking.status === "pending_payment" ? (
              <li
                key={booking.bookingId}
                className="border-b border-[var(--color-border)] p-4 last:border-0"
              >
                <div>
                  <Link href={`/bookings/${booking.bookingId}`} className="block">
                    <div className="flex gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                        {booking.expertAvatarUrl ? (
                          <Image
                            src={booking.expertAvatarUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                            {booking.expertInitials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {booking.expertName}
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles(booking.status)}`}
                          >
                            {(
                              isMessagingSession(booking.sessionType) &&
                              String(booking.status) === "confirmed"
                                ? "Awaiting reply"
                                : formatStatusLabel(booking.status)
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {booking.serviceName}
                        </p>
                        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="mr-1.5" aria-hidden>
                            {sessionTypeIcon(booking.sessionType)}
                          </span>
                          {sessionTypeLabel(booking.sessionType)}
                        </p>
                        {booking.scheduledAt ? (
                          <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {formatBookingDateTime(booking.scheduledAt)}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {isMessagingSession(booking.sessionType)
                              ? "Messaging session"
                              : "Time to be arranged"}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDurationMinutes(booking.durationMinutes)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                    <p>
                      Payment incomplete — this slot will be released in 15
                      minutes if payment is not completed.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        className="resume-payment-btn rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-amber-500 dark:hover:bg-amber-400"
                        data-booking-id={booking.bookingId}
                        data-default-label="Complete payment"
                      >
                        Complete payment
                      </button>
                      <p
                        className="resume-payment-error hidden text-sm text-rose-700 dark:text-rose-300"
                        aria-live="polite"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ) : (
              <li key={booking.bookingId} className="border-b border-[var(--color-border)] p-4 last:border-0">
                <ConsumerBookingCard {...booking} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
