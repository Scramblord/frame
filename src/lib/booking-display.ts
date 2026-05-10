/** Consumer-facing date/time, e.g. "Thu 9 Apr 2026, 12:15" */
export function formatBookingDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sessionTypeIcon(sessionType: string): string {
  switch (sessionType) {
    case "messaging":
    case "urgent_messaging":
      return "💬";
    case "audio":
      return "🎙️";
    case "video":
      return "📹";
    default:
      return "•";
  }
}

export function sessionTypeLabel(sessionType: string): string {
  switch (sessionType) {
    case "messaging":
      return "Messaging";
    case "urgent_messaging":
      return "Urgent messaging";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    default:
      return sessionType.replace(/_/g, " ");
  }
}

/** Title case phrase for status badge */
export function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusBadgeStyles(status: string): string {
  switch (status) {
    case "confirmed":
    case "in_progress":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "pending_payment":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "completed":
    case "reviewed":
      return "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";
    case "cancelled":
    case "no_show":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200";
  }
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** Session is live: in progress, or confirmed and the scheduled start has passed. */
export function isBookingLiveNow(
  status: string,
  scheduledAt: string | null,
  now: Date = new Date(),
): boolean {
  if (status === "in_progress") return true;
  if (status !== "confirmed" || scheduledAt == null) return false;
  return new Date(scheduledAt).getTime() <= now.getTime();
}

/** Sort upcoming: live sessions first, then by scheduled time ascending. */
export function compareUpcomingBookings(
  a: { status: string; scheduledAt: string | null },
  b: { status: string; scheduledAt: string | null },
  now: Date = new Date(),
): number {
  const liveA = isBookingLiveNow(a.status, a.scheduledAt, now);
  const liveB = isBookingLiveNow(b.status, b.scheduledAt, now);
  if (liveA !== liveB) return liveA ? -1 : 1;

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
}
