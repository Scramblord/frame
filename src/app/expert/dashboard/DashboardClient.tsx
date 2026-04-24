"use client";

import { formatGbp } from "@/lib/experts-marketplace";
import Link from "next/link";
import { useMemo, useState } from "react";

type ScheduleTab = "video" | "audio" | "messaging";
type EarningsRange = "month" | "year" | "all";
type SettingsTab = "availability" | "profile" | "pricing";

type HeaderData = {
  greeting: string;
  subtitle: string;
};

type StatCardData = {
  label: string;
  value: string;
  delta?: string;
};

type AvBookingRow = {
  id: string;
  sessionType: "video" | "audio";
  consumerName: string;
  consumerInitials: string;
  serviceName: string;
  scheduledLabel: string;
  durationLabel: string;
};

type MessagingBookingRow = {
  id: string;
  consumerName: string;
  consumerInitials: string;
  preview: string;
  lastActivityLabel: string;
  unread: boolean;
};

type EarningsSnapshot = {
  label: string;
  totalRevenueGbp: number;
  sessionCount: number;
  avgPerSessionGbp: number;
  byFormat: {
    video: { sessions: number; revenueGbp: number };
    audio: { sessions: number; revenueGbp: number };
    messaging: { sessions: number; revenueGbp: number };
  };
};

type EarningsBookingRow = {
  id: string;
  session_type: string;
  scheduled_at: string | null;
  total_amount: number | string | null;
};

type RecentPayout = {
  id: string;
  dateLabel: string;
  amountGbp: number;
};

type AvailabilitySummary = {
  timezone: string;
  lines: string[];
};

type ProfileSummary = {
  bio: string | null;
  keywords: string[];
};

type PricingSummaryItem = {
  id: string;
  name: string;
  isActive: boolean;
  rates: string[];
};

type DashboardClientProps = {
  header: HeaderData;
  stats: StatCardData[];
  stripeOnboardingComplete: boolean;
  schedule: {
    video: AvBookingRow[];
    audio: AvBookingRow[];
    messaging: MessagingBookingRow[];
    counts: {
      video: number;
      audio: number;
      messaging: number;
      messagingUnread: number;
    };
  };
  earnings: {
    completedBookings: EarningsBookingRow[];
    currentMonthLabel: string;
    recentPayouts: RecentPayout[];
  };
  settings: {
    availability: AvailabilitySummary;
    profile: ProfileSummary;
    pricing: PricingSummaryItem[];
  };
};

function formatPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 80) return trimmed || "No messages yet.";
  return `${trimmed.slice(0, 80).trimEnd()}...`;
}

function toPence(value: number | string | null): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function computeEarningsSnapshot(rows: EarningsBookingRow[], label: string): EarningsSnapshot {
  let totalPence = 0;
  const byFormat = {
    video: { sessions: 0, revenuePence: 0 },
    audio: { sessions: 0, revenuePence: 0 },
    messaging: { sessions: 0, revenuePence: 0 },
  };

  for (const row of rows) {
    const totalAmountPence = toPence(row.total_amount);
    totalPence += totalAmountPence;
    if (row.session_type === "video") {
      byFormat.video.sessions += 1;
      byFormat.video.revenuePence += totalAmountPence;
    } else if (row.session_type === "audio") {
      byFormat.audio.sessions += 1;
      byFormat.audio.revenuePence += totalAmountPence;
    } else if (
      row.session_type === "messaging" ||
      row.session_type === "urgent_messaging"
    ) {
      byFormat.messaging.sessions += 1;
      byFormat.messaging.revenuePence += totalAmountPence;
    }
  }

  return {
    label,
    totalRevenueGbp: totalPence / 100,
    sessionCount: rows.length,
    avgPerSessionGbp: rows.length > 0 ? totalPence / 100 / rows.length : 0,
    byFormat: {
      video: {
        sessions: byFormat.video.sessions,
        revenueGbp: byFormat.video.revenuePence / 100,
      },
      audio: {
        sessions: byFormat.audio.sessions,
        revenueGbp: byFormat.audio.revenuePence / 100,
      },
      messaging: {
        sessions: byFormat.messaging.sessions,
        revenueGbp: byFormat.messaging.revenuePence / 100,
      },
    },
  };
}

function avatarTone(seed: string): string {
  const classes = [
    "bg-indigo-500 text-white",
    "bg-sky-500 text-white",
    "bg-violet-500 text-white",
    "bg-emerald-500 text-white",
    "bg-amber-500 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return classes[Math.abs(hash) % classes.length] ?? classes[0];
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-[2rem] font-semibold leading-tight tracking-tight text-zinc-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
    </div>
  );
}

export default function DashboardClient({
  header,
  stats,
  stripeOnboardingComplete,
  schedule,
  earnings,
  settings,
}: DashboardClientProps) {
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("video");
  const [earningsRange, setEarningsRange] = useState<EarningsRange>("month");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("availability");

  const currentEarnings = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

    const monthRows = earnings.completedBookings.filter((row) => {
      if (!row.scheduled_at) return false;
      const when = new Date(row.scheduled_at);
      return when >= monthStart && when < nextMonthStart;
    });
    const yearRows = earnings.completedBookings.filter((row) => {
      if (!row.scheduled_at) return false;
      const when = new Date(row.scheduled_at);
      return when >= yearStart && when < nextYearStart;
    });

    if (earningsRange === "month") {
      return computeEarningsSnapshot(monthRows, earnings.currentMonthLabel);
    }
    if (earningsRange === "year") {
      return computeEarningsSnapshot(yearRows, String(now.getFullYear()));
    }
    return computeEarningsSnapshot(earnings.completedBookings, "All-time");
  }, [earnings, earningsRange]);
  const maxByFormatRevenue = Math.max(
    currentEarnings.byFormat.video.revenueGbp,
    currentEarnings.byFormat.audio.revenueGbp,
    currentEarnings.byFormat.messaging.revenueGbp,
    1,
  );

  const scheduleRows = useMemo(() => {
    if (scheduleTab === "messaging") return schedule.messaging;
    return schedule[scheduleTab];
  }, [schedule, scheduleTab]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          {header.greeting}
        </h1>
        <p className="mt-1 text-2xl text-zinc-500">{header.subtitle}</p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(17,24,39,0.05)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-2 text-4xl font-semibold leading-none tracking-tight text-zinc-900">
              {card.value}
            </p>
            <p className="mt-2 min-h-5 text-sm text-emerald-700">{card.delta ?? "\u00A0"}</p>
          </article>
        ))}
      </section>

      {!stripeOnboardingComplete ? (
        <section className="mt-8 rounded-xl border border-amber-300/90 bg-amber-50 px-5 py-4 shadow-[0_1px_2px_rgba(17,24,39,0.05)]">
          <p className="text-sm font-medium text-amber-950">
            Connect your bank account to receive payouts from completed sessions.
          </p>
          <Link
            href="/expert/connect"
            className="mt-3 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            Connect bank account
          </Link>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title="Schedule" subtitle="Upcoming sessions by format" />
          <Link
            href="/expert/availability"
            className="inline-flex rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          >
            + Set availability
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: "video", label: "Video", icon: "📹", count: schedule.counts.video },
              { id: "audio", label: "Audio", icon: "🎙", count: schedule.counts.audio },
              {
                id: "messaging",
                label: "Messaging",
                icon: "💬",
                count: schedule.counts.messaging,
              },
            ] as const
          ).map((tab) => {
            const active = scheduleTab === tab.id;
            const messagingHighlight =
              tab.id === "messaging" && schedule.counts.messagingUnread > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScheduleTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-zinc-300 bg-white text-zinc-900"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    messagingHighlight
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.05)]">
          {scheduleTab === "messaging" ? (
            scheduleRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                No active message threads.
              </p>
            ) : (
              <ul className="space-y-3">
                {(scheduleRows as MessagingBookingRow[]).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3"
                  >
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(
                        row.id,
                      )}`}
                    >
                      {row.consumerInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-900">{row.consumerName}</p>
                      <p className="truncate text-sm text-zinc-500">{formatPreview(row.preview)}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm text-zinc-500">{row.lastActivityLabel}</p>
                      {row.unread ? (
                        <span className="ml-auto mt-2 block h-2 w-2 rounded-full bg-indigo-500" />
                      ) : null}
                    </div>
                    <Link
                      href={`/expert/bookings/${row.id}`}
                      className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:border-zinc-400"
                    >
                      View conversation
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : scheduleRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
              No upcoming video or audio sessions.
            </p>
          ) : (
            <ul className="space-y-3">
              {(scheduleRows as AvBookingRow[]).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3"
                >
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(
                      row.id,
                    )}`}
                  >
                    {row.consumerInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900">{row.consumerName}</p>
                    <p className="truncate text-sm text-zinc-500">{row.serviceName}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-medium text-zinc-900">{row.scheduledLabel}</p>
                    <p className="text-sm text-zinc-500">{row.durationLabel}</p>
                  </div>
                  <Link
                    href={`/expert/bookings/${row.id}`}
                    className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:border-zinc-400"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title="Earnings" subtitle="Revenue across all session formats" />
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1">
            {(["month", "year", "all"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setEarningsRange(range)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                  earningsRange === range
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(17,24,39,0.05)]">
          <div className="grid gap-0 sm:grid-cols-3">
            <div className="border-b border-zinc-200 px-5 py-5 sm:border-b-0 sm:border-r">
              <p className="text-sm text-zinc-500">{currentEarnings.label} earnings</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight text-zinc-900">
                {formatGbp(currentEarnings.totalRevenueGbp)}
              </p>
            </div>
            <div className="border-b border-zinc-200 px-5 py-5 sm:border-b-0 sm:border-r">
              <p className="text-sm text-zinc-500">Sessions</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight text-zinc-900">
                {currentEarnings.sessionCount}
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-zinc-500">Avg / session</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight text-zinc-900">
                {formatGbp(currentEarnings.avgPerSessionGbp)}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              By format
            </p>
            <div className="mt-3 space-y-3">
              {(
                [
                  {
                    key: "video",
                    icon: "📹",
                    label: "Video",
                    data: currentEarnings.byFormat.video,
                  },
                  {
                    key: "audio",
                    icon: "🎙",
                    label: "Audio",
                    data: currentEarnings.byFormat.audio,
                  },
                  {
                    key: "messaging",
                    icon: "💬",
                    label: "Messaging",
                    data: currentEarnings.byFormat.messaging,
                  },
                ] as const
              ).map((row) => {
                const widthPct = Math.max(
                  6,
                  Math.round((row.data.revenueGbp / maxByFormatRevenue) * 100),
                );
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <p className="text-zinc-800">
                        <span className="mr-1">{row.icon}</span>
                        {row.label}{" "}
                        <span className="text-zinc-500">({row.data.sessions})</span>
                      </p>
                      <p className="font-semibold text-zinc-900">
                        {formatGbp(row.data.revenueGbp)}
                      </p>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-200">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500"
                        style={{ width: `${row.data.revenueGbp <= 0 ? 0 : widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Recent payouts
            </p>
            {earnings.recentPayouts.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No paid payouts yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-200">
                {earnings.recentPayouts.map((payout) => (
                  <li key={payout.id} className="flex items-center justify-between py-2.5">
                    <span className="text-zinc-600">{payout.dateLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {formatGbp(payout.amountGbp)}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Paid
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="Settings" subtitle="Availability, profile, and pricing" />
        <div className="mt-4 inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1">
          {(["availability", "profile", "pricing"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSettingsTab(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                settingsTab === tab
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.05)]">
          {settingsTab === "availability" ? (
            <>
              <p className="text-sm text-zinc-500">
                Times shown in {settings.availability.timezone}.
              </p>
              {settings.availability.lines.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No weekly availability set.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  {settings.availability.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              <Link
                href="/expert/availability"
                className="mt-4 inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
              >
                Edit availability →
              </Link>
            </>
          ) : null}

          {settingsTab === "profile" ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {settings.profile.bio?.trim()
                  ? settings.profile.bio.trim().slice(0, 260)
                  : "No bio yet."}
                {settings.profile.bio && settings.profile.bio.length > 260 ? "..." : ""}
              </p>
              {settings.profile.keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {settings.profile.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
              <Link
                href="/expert/setup"
                className="mt-4 inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
              >
                Edit profile →
              </Link>
            </>
          ) : null}

          {settingsTab === "pricing" ? (
            <>
              {settings.pricing.length === 0 ? (
                <p className="text-sm text-zinc-500">No services configured yet.</p>
              ) : (
                <ul className="space-y-3">
                  {settings.pricing.map((service) => (
                    <li
                      key={service.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
                    >
                      <p className="font-semibold text-zinc-900">
                        {service.name}
                        {!service.isActive ? (
                          <span className="ml-2 text-xs font-medium text-zinc-500">
                            (inactive)
                          </span>
                        ) : null}
                      </p>
                      {service.rates.length === 0 ? (
                        <p className="mt-1 text-sm text-zinc-500">No rates configured</p>
                      ) : (
                        <ul className="mt-1 text-sm text-zinc-600">
                          {service.rates.map((rate) => (
                            <li key={rate}>{rate}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/expert/setup"
                className="mt-4 inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
              >
                Edit pricing →
              </Link>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
