import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import {
  formatGbp,
  lowestPriceForService,
} from "@/lib/experts-marketplace";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, location")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!expert) {
    redirect("/expert/setup");
  }

  const { data: serviceRows } = await supabase
    .from("services")
    .select("*")
    .eq("expert_user_id", user.id)
    .order("created_at", { ascending: true });

  const services = serviceRows ?? [];

  const { data: availabilityRows } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("expert_user_id", user.id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true });

  const availability = availabilityRows ?? [];

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function formatAvailTime(t: string) {
    return t.length >= 5 ? t.slice(0, 5) : t;
  }

  const { count: sessionsCompleted } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("expert_user_id", user.id)
    .eq("status", "completed");

  const { data: statsRows, error: statsError } = await supabase.rpc(
    "get_expert_review_stats",
    { p_expert_user_id: user.id },
  );

  let avgRating: number | null = null;
  let reviewCount = 0;

  if (!statsError && statsRows != null) {
    const row = Array.isArray(statsRows) ? statsRows[0] : statsRows;
    if (row && typeof row === "object") {
      const rc = (row as { review_count?: number }).review_count;
      const ar = (row as { avg_rating?: string | number | null }).avg_rating;
      reviewCount = rc != null ? Number(rc) : 0;
      avgRating =
        ar != null && ar !== ""
          ? Number(ar)
          : null;
    }
  } else {
    const { data: revs } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", user.id);
    const list = revs ?? [];
    reviewCount = list.length;
    avgRating =
      reviewCount > 0
        ? list.reduce((s, r) => s + r.rating, 0) / reviewCount
        : null;
  }

  const nowIso = new Date().toISOString();
  const { data: upcomingRows } = await supabase
    .from("bookings")
    .select("id, scheduled_at, duration_minutes, status")
    .eq("expert_user_id", user.id)
    .gte("scheduled_at", nowIso)
    .in("status", ["pending", "confirmed"])
    .order("scheduled_at", { ascending: true })
    .limit(20);

  const upcoming = upcomingRows ?? [];

  const keywords = expert?.keywords ?? [];

  const hasPublishedRates = services.some(
    (s) => lowestPriceForService(s) != null,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Expert dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile and sessions.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Profile
              </h2>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.full_name?.trim() || "Expert"}
              </p>
              {profile.location ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {profile.location}
                </p>
              ) : null}
            </div>
            <Link
              href="/expert/setup"
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Edit profile
            </Link>
          </div>

          {expert?.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {String(expert.bio)}
            </p>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No bio yet — add one when you edit your profile.
            </p>
          )}

          {keywords.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Specialities
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {keywords.map((k: string) => (
                  <li
                    key={k}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Services
            </p>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                No services yet — add them in profile setup.
              </p>
            ) : (
              <ul className="mt-3 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                {services.map((svc) => (
                  <li
                    key={svc.id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {svc.name}
                      {!svc.is_active ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          (inactive)
                        </span>
                      ) : null}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {svc.offers_messaging &&
                      svc.messaging_flat_rate != null ? (
                        <li>
                          Messaging:{" "}
                          {formatGbp(Number(svc.messaging_flat_rate))} flat
                        </li>
                      ) : null}
                      {svc.offers_audio && svc.audio_hourly_rate != null ? (
                        <li>
                          Audio: {formatGbp(Number(svc.audio_hourly_rate))} / hr
                        </li>
                      ) : null}
                      {svc.offers_video && svc.video_hourly_rate != null ? (
                        <li>
                          Video: {formatGbp(Number(svc.video_hourly_rate))} / hr
                        </li>
                      ) : null}
                      {!svc.offers_messaging &&
                      !svc.offers_audio &&
                      !svc.offers_video ? (
                        <li className="text-zinc-500">No rates configured</li>
                      ) : null}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {!hasPublishedRates && services.length > 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Enable consultation types and pricing in profile setup.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Availability
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your timezone:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {expert?.timezone?.trim() || "UTC"}
                </span>
              </p>
            </div>
            <Link
              href="/expert/availability"
              className="shrink-0 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
            >
              Edit availability
            </Link>
          </div>
          {availability.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No weekly hours set yet. Add your schedule so clients know when you
              can take bookings.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {availability.map((a) => (
                <li
                  key={a.day_of_week}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {DAY_NAMES[a.day_of_week] ?? "Day"}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatAvailTime(String(a.start_time))} –{" "}
                    {formatAvailTime(String(a.end_time))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Upcoming bookings
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
              No upcoming sessions. When clients book you, they&apos;ll appear
              here.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(b.scheduled_at).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {b.duration_minutes} min · {b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your stats
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Sessions completed
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {sessionsCompleted ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Average rating
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {avgRating != null && !Number.isNaN(avgRating)
                  ? avgRating.toFixed(1)
                  : "—"}
                {avgRating != null && !Number.isNaN(avgRating) ? (
                  <span className="text-lg text-amber-500"> ★</span>
                ) : null}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reviews
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {reviewCount}
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
