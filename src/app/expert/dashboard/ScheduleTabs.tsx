"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ScheduleBooking = {
  bookingId: string;
  consumerName: string;
  consumerInitials: string;
  serviceName: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  isUnread?: boolean;
};

type ScheduleTabsProps = {
  videoAudioBookings: ScheduleBooking[];
  messagingBookings: ScheduleBooking[];
  hasUnreadMessages: boolean;
};

function formatScheduleDateTime(scheduledAt: string | null): string {
  if (!scheduledAt) return "Time to be arranged";
  const date = new Date(scheduledAt);
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const ts = date.getTime();
  if (ts >= todayStart.getTime() && ts < tomorrowStart.getTime()) {
    return `Today, ${timeLabel}`;
  }
  if (ts >= tomorrowStart.getTime() && ts < dayAfterTomorrowStart.getTime()) {
    return `Tomorrow, ${timeLabel}`;
  }

  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday} ${day} ${month}, ${timeLabel}`;
}

function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "No recent messages";
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ScheduleTabs({
  videoAudioBookings,
  messagingBookings,
  hasUnreadMessages,
}: ScheduleTabsProps) {
  const [activeTab, setActiveTab] = useState<"video-audio" | "messaging">(
    "video-audio",
  );

  const tabs = useMemo(
    () => [
      { id: "video-audio" as const, label: "Video & Audio", count: videoAudioBookings.length },
      { id: "messaging" as const, label: "Messaging", count: messagingBookings.length },
    ],
    [videoAudioBookings.length, messagingBookings.length],
  );

  return (
    <div>
      <div className="flex gap-0 border-b border-[var(--color-border)] px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isMessagingTab = tab.id === "messaging";
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
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-xs ${
                  isMessagingTab && hasUnreadMessages
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "video-audio" ? (
        videoAudioBookings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-2xl" aria-hidden>
              {"\u{1F4C5}"}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              No upcoming video or audio sessions
            </p>
          </div>
        ) : (
          <ul>
            {videoAudioBookings.map((booking) => (
              <li
                key={booking.bookingId}
                className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-4 last:border-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">
                  {booking.consumerInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {booking.consumerName}
                  </p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {booking.serviceName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {formatScheduleDateTime(booking.scheduledAt)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {booking.durationMinutes != null
                      ? `${booking.durationMinutes} min`
                      : "Duration TBC"}
                  </p>
                </div>
                <Link
                  href={`/expert/bookings/${booking.bookingId}`}
                  className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-zinc-50"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : messagingBookings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No active message threads
          </p>
        </div>
      ) : (
        <ul>
          {messagingBookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-4 last:border-0"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">
                {booking.consumerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {booking.consumerName}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">
                  {(booking.lastMessagePreview ?? "No recent messages").slice(0, 80)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span>{formatRelativeTime(booking.lastMessageAt)}</span>
                {booking.isUnread ? (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                ) : null}
              </div>
              <Link
                href={`/expert/bookings/${booking.bookingId}`}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-zinc-50"
              >
                View conversation
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
