"use client";

import { useMemo, useState } from "react";
import {
  ConsumerBookingCard,
  type ConsumerBookingCardProps,
} from "@/components/ConsumerBookingCard";
import {
  ExpertBookingCard,
  type ExpertBookingCardProps,
} from "@/components/ExpertBookingCard";

export type PastStatusFilter = "all" | "completed" | "cancelled" | "no_show";

function matchesPastFilter(status: string, filter: PastStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cancelled") return status === "cancelled";
  if (filter === "no_show") return status === "no_show";
  if (filter === "completed") {
    return status === "completed";
  }
  return true;
}

/** Newest scheduled session first; null/invalid dates last. PostgREST can return rows in index order — this enforces true chronological order. */
function sortByScheduledAtDesc<
  T extends { scheduledAt: string | null; bookingId: string },
>(items: T[]): T[] {
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
    const diff = tb - ta;
    if (diff !== 0) return diff;
    return b.bookingId.localeCompare(a.bookingId);
  });
}

type Props =
  | { variant: "consumer"; cards: ConsumerBookingCardProps[] }
  | { variant: "expert"; cards: ExpertBookingCardProps[] };

export function PastBookingsFilteredList(props: Props) {
  const [filter, setFilter] = useState<PastStatusFilter>("all");
  const filtered = useMemo(() => {
    const list = props.cards.filter((c) =>
      matchesPastFilter(c.status, filter),
    );
    return sortByScheduledAtDesc(list);
  }, [props.cards, filter]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label
          htmlFor="past-status-filter"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Filter by status
        </label>
        <select
          id="past-status-filter"
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as PastStatusFilter)
          }
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-auto dark:border-zinc-600 dark:bg-zinc-900"
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No bookings match this filter.
        </p>
      ) : props.variant === "consumer" ? (
        <ul className="mt-6 space-y-3">
          {(filtered as ConsumerBookingCardProps[]).map((c) => (
            <li key={c.bookingId}>
              <ConsumerBookingCard {...c} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-6 space-y-3">
          {(filtered as ExpertBookingCardProps[]).map((c) => (
            <li key={c.bookingId}>
              <ExpertBookingCard {...c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
