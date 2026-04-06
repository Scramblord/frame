/** Audio/video session join: 15 min before start through scheduled end, or anytime while in_progress. */

export function canShowJoinSession(params: {
  sessionType: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
}): boolean {
  if (params.sessionType !== "audio" && params.sessionType !== "video") {
    return false;
  }
  if (
    params.status === "completed" ||
    params.status === "cancelled" ||
    params.status === "no_show" ||
    params.status === "pending_payment"
  ) {
    return false;
  }
  if (params.status === "in_progress") {
    return true;
  }
  if (params.status !== "confirmed") {
    return false;
  }
  if (!params.scheduledAt || params.durationMinutes == null) {
    return false;
  }
  const start = new Date(params.scheduledAt).getTime();
  const end = start + params.durationMinutes * 60 * 1000;
  const now = Date.now();
  return now >= start - 15 * 60 * 1000 && now <= end;
}
