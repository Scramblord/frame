"use client";

import { useSearchParams } from "next/navigation";
import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PastStatusFilter = "all" | "completed" | "cancelled" | "no_show";

function matchesPastFilter(status: string, filter: PastStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cancelled") return status === "cancelled";
  if (filter === "no_show") return status === "no_show";
  if (filter === "completed") {
    return status === "completed";
  }
  return true;
}

function sortByScheduledAtDesc<T extends { scheduledAt: string | null; index: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta =
      a.scheduledAt != null
        ? new Date(a.scheduledAt).getTime()
        : Number.NEGATIVE_INFINITY;
    const tb =
      b.scheduledAt != null
        ? new Date(b.scheduledAt).getTime()
        : Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return a.index - b.index;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    const diff = tb - ta;
    if (diff !== 0) return diff;
    return b.index - a.index;
  });
}

function extractBookingMeta(
  node: ReactNode,
): { status: string; scheduledAt: string | null } | null {
  if (!isValidElement(node)) return null;
  const props = node.props as {
    status?: unknown;
    scheduledAt?: unknown;
    children?: ReactNode;
  };
  if (typeof props.status === "string") {
    return {
      status: props.status,
      scheduledAt:
        typeof props.scheduledAt === "string" || props.scheduledAt === null
          ? props.scheduledAt
          : null,
    };
  }
  if (!props.children) return null;
  for (const child of Children.toArray(props.children)) {
    const meta = extractBookingMeta(child);
    if (meta) return meta;
  }
  return null;
}

type BookingTypeTabsProps = {
  videoAudioBookings: ReactNode[];
  messagingBookings: ReactNode[];
};

export default function BookingTypeTabs({
  videoAudioBookings,
  messagingBookings,
}: BookingTypeTabsProps) {
  const [activeTab, setActiveTab] = useState<"video-audio" | "messaging">(
    "video-audio",
  );
  const [pastFilter, setPastFilter] = useState<PastStatusFilter>("all");
  const searchParams = useSearchParams();
  const isPastTab = searchParams.get("tab") === "past";

  const tabs = useMemo(
    () => [
      { id: "video-audio" as const, label: "Video & Audio", count: videoAudioBookings.length },
      { id: "messaging" as const, label: "Messaging", count: messagingBookings.length },
    ],
    [videoAudioBookings.length, messagingBookings.length],
  );

  const getDisplayedBookings = (bookings: ReactNode[]) => {
    if (!isPastTab) return bookings;
    const withMeta = bookings.map((booking, index) => ({
      booking,
      index,
      meta: extractBookingMeta(booking),
    }));
    const filtered = withMeta.filter(({ meta }) =>
      matchesPastFilter(meta?.status ?? "", pastFilter),
    );
    return sortByScheduledAtDesc(
      filtered.map(({ booking, index, meta }) => ({
        booking,
        index,
        scheduledAt: meta?.scheduledAt ?? null,
      })),
    ).map(({ booking }) => booking);
  };

  const displayedVideoAudioBookings = getDisplayedBookings(videoAudioBookings);
  const displayedMessagingBookings = getDisplayedBookings(messagingBookings);

  return (
    <div>
      {isPastTab ? (
        <div className="mt-6 flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="past-status-filter-expert"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Filter by status
          </label>
          <select
            id="past-status-filter-expert"
            value={pastFilter}
            onChange={(e) => setPastFilter(e.target.value as PastStatusFilter)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-auto dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      ) : null}

      <div className="flex gap-0 border-b border-[var(--color-border)] px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px cursor-pointer px-4 py-3 text-sm font-medium ${
                isActive
                  ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "video-audio" ? (
        displayedVideoAudioBookings.length > 0 ? (
          <ul>{displayedVideoAudioBookings}</ul>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {isPastTab
                ? "No bookings match this filter."
                : "No video or audio bookings."}
            </p>
          </div>
        )
      ) : displayedMessagingBookings.length > 0 ? (
        <ul>{displayedMessagingBookings}</ul>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {isPastTab ? "No bookings match this filter." : "No messaging bookings."}
          </p>
        </div>
      )}
    </div>
  );
}
