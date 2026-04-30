"use client";

import { ExpertBookingCard, type ExpertBookingCardProps } from "@/components/ExpertBookingCard";
import { useMemo, useState } from "react";

type FormatFilter = "all" | "video-audio" | "messaging";
type PastStatusFilter = "all" | "completed" | "cancelled" | "no_show";

type BookingsViewProps = {
  allBookings: ExpertBookingCardProps[];
  isPast: boolean;
};

function isMessagingSession(sessionType: string): boolean {
  return sessionType === "messaging" || sessionType === "urgent_messaging";
}

function sortByScheduledAtAsc(items: ExpertBookingCardProps[]): ExpertBookingCardProps[] {
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

function sortByScheduledAtDesc(items: ExpertBookingCardProps[]): ExpertBookingCardProps[] {
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
          {filteredBookings.map((booking) => (
            <li key={booking.bookingId} className="border-b border-[var(--color-border)] p-4 last:border-0">
              <ExpertBookingCard {...booking} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
