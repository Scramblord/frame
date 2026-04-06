import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

/**
 * Shows a rejoin banner when the user has an in-progress session that has not passed its end time.
 */
export async function ActiveSessionBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: asConsumer }, { data: asExpert }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, scheduled_at, duration_minutes, consumer_user_id, expert_user_id",
      )
      .eq("consumer_user_id", user.id)
      .eq("status", "in_progress"),
    supabase
      .from("bookings")
      .select(
        "id, scheduled_at, duration_minutes, consumer_user_id, expert_user_id",
      )
      .eq("expert_user_id", user.id)
      .eq("status", "in_progress"),
  ]);

  const list = [...(asConsumer ?? []), ...(asExpert ?? [])];
  const now = Date.now();

  const active = list.find((b) => {
    if (!b.scheduled_at || b.duration_minutes == null) return false;
    const start = new Date(b.scheduled_at).getTime();
    const end = start + b.duration_minutes * 60 * 1000;
    return end > now;
  });

  if (!active) return null;

  const otherUserId =
    active.consumer_user_id === user.id
      ? active.expert_user_id
      : active.consumer_user_id;

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", otherUserId)
    .maybeSingle();

  const otherName = otherProfile?.full_name?.trim() || "your partner";
  const start = new Date(active.scheduled_at!).getTime();
  const end = start + active.duration_minutes! * 60 * 1000;
  const remainingMin = Math.max(1, Math.ceil((end - now) / 60000));

  const sessionHref = `/session/${active.id}`;

  return (
    <div className="border-b border-emerald-800/80 bg-emerald-950 px-4 py-3 text-center sm:text-left">
      <p className="text-sm font-medium text-emerald-50">
        Your session with {otherName} is in progress · {remainingMin} minute
        {remainingMin === 1 ? "" : "s"} remaining —{" "}
        <Link
          href={sessionHref}
          className="font-semibold text-white underline underline-offset-2 hover:text-emerald-100"
        >
          Rejoin now
        </Link>
      </p>
    </div>
  );
}
