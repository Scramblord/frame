import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import Navbar from "@/components/Navbar";
import { formatGbp } from "@/lib/experts-marketplace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  consumer_user_id: string;
  service_id: string;
  session_type: "video" | "audio" | "messaging" | "urgent_messaging" | string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string;
  total_amount: number | string | null;
  platform_fee: number | string | null;
  created_at: string;
};

type MessageRow = {
  booking_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function toPence(value: number | string | null): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return "?";
  return clean
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function greetingForHour(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatUpcomingLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isTomorrow) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${time}`;
}

function formatRelativeTime(iso: string): string {
  const deltaMs = new Date(iso).getTime() - Date.now();
  const deltaMin = Math.round(deltaMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, "minute");
  const deltaHours = Math.round(deltaMin / 60);
  if (Math.abs(deltaHours) < 24) return rtf.format(deltaHours, "hour");
  const deltaDays = Math.round(deltaHours / 24);
  return rtf.format(deltaDays, "day");
}

function computeEarningsSnapshot(
  rows: BookingRow[],
  label: string,
): {
  label: string;
  totalRevenueGbp: number;
  sessionCount: number;
  avgPerSessionGbp: number;
  byFormat: {
    video: { sessions: number; revenueGbp: number };
    audio: { sessions: number; revenueGbp: number };
    messaging: { sessions: number; revenueGbp: number };
  };
} {
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

export default async function ExpertDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, location, bio")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/onboarding");
  }

  const { data: expert, error: expertError } = await supabase
    .from("expert_profiles")
    .select("id, user_id, timezone, keywords, bio, stripe_onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (expertError || !expert) {
    redirect("/expert/setup");
  }

  const [
    servicesQuery,
    availabilityQuery,
    weekSessionsQuery,
    completedAllQuery,
    ratingsQuery,
    avBookingsQuery,
    messagingBookingsQuery,
    paidPayoutsQuery,
  ] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, is_active, offers_messaging, messaging_flat_rate, offers_audio, audio_hourly_rate, offers_video, video_hourly_rate",
      )
      .eq("expert_user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("availability")
      .select("id, day_of_week, start_time, end_time, is_active")
      .eq("expert_user_id", user.id)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("expert_user_id", user.id)
      .in("status", ["confirmed", "in_progress"])
      .gte("scheduled_at", weekStart.toISOString())
      .lt("scheduled_at", weekEnd.toISOString()),
    supabase
      .from("bookings")
      .select(
        "id, consumer_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, created_at",
      )
      .eq("expert_user_id", user.id)
      .eq("status", "completed"),
    supabase.from("reviews").select("rating").eq("reviewee_id", user.id),
    supabase
      .from("bookings")
      .select(
        "id, consumer_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, created_at",
      )
      .eq("expert_user_id", user.id)
      .in("status", ["confirmed", "in_progress"])
      .in("session_type", ["video", "audio"])
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("bookings")
      .select(
        "id, consumer_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, created_at",
      )
      .eq("expert_user_id", user.id)
      .in("status", ["confirmed", "in_progress"])
      .in("session_type", ["messaging", "urgent_messaging"]),
    supabase
      .from("bookings")
      .select("id, created_at, total_amount, platform_fee, stripe_transfer_id")
      .eq("expert_user_id", user.id)
      .not("stripe_transfer_id", "is", null)
      .eq("stripe_transfer_status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const services = servicesQuery.data ?? [];
  const availability = availabilityQuery.data ?? [];
  const weekSessions = weekSessionsQuery.count ?? 0;
  const completedAll = (completedAllQuery.data ?? []) as BookingRow[];
  const ratings = ratingsQuery.data ?? [];
  const avBookings = (avBookingsQuery.data ?? []) as BookingRow[];
  const messagingBookings = (messagingBookingsQuery.data ?? []) as BookingRow[];
  const paidPayouts = paidPayoutsQuery.data ?? [];

  const serviceById = new Map<string, string>(
    services.map((service) => [String(service.id), String(service.name ?? "Session")]),
  );

  const consumerIds = Array.from(
    new Set(
      [...avBookings, ...messagingBookings].map((booking) => booking.consumer_user_id),
    ),
  );

  const { data: consumerProfiles } =
    consumerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", consumerIds)
      : { data: [] };

  const consumerNameById = new Map<string, string>(
    (consumerProfiles ?? []).map((row) => [
      String(row.user_id),
      String(row.full_name ?? "Client"),
    ]),
  );

  const messagingBookingIds = messagingBookings.map((booking) => booking.id);
  const { data: messageRows } =
    messagingBookingIds.length > 0
      ? await supabase
          .from("messages")
          .select("booking_id, sender_id, content, created_at")
          .in("booking_id", messagingBookingIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const latestMessageByBooking = new Map<string, MessageRow>();
  for (const msg of (messageRows ?? []) as MessageRow[]) {
    if (!latestMessageByBooking.has(msg.booking_id)) {
      latestMessageByBooking.set(msg.booking_id, msg);
    }
  }

  const avRows = avBookings.map((booking) => {
    const consumerName = consumerNameById.get(booking.consumer_user_id) ?? "Client";
    return {
      id: booking.id,
      sessionType: booking.session_type === "audio" ? "audio" : "video",
      consumerName,
      consumerInitials: initials(consumerName),
      serviceName: serviceById.get(booking.service_id) ?? "Session",
      scheduledLabel: booking.scheduled_at
        ? formatUpcomingLabel(booking.scheduled_at)
        : "Time to be arranged",
      durationLabel:
        booking.duration_minutes != null ? `${booking.duration_minutes} min` : "—",
    };
  });

  const messagingRows = messagingBookings
    .map((booking) => {
      const consumerName = consumerNameById.get(booking.consumer_user_id) ?? "Client";
      const latest = latestMessageByBooking.get(booking.id);
      return {
        id: booking.id,
        consumerName,
        consumerInitials: initials(consumerName),
        preview: latest?.content ?? "No messages yet.",
        lastActivityLabel: latest?.created_at
          ? formatRelativeTime(latest.created_at)
          : "No activity yet",
        unread: Boolean(latest && latest.sender_id !== user.id),
        activitySortTs: latest?.created_at
          ? new Date(latest.created_at).getTime()
          : new Date(booking.created_at).getTime(),
      };
    })
    .sort((a, b) => b.activitySortTs - a.activitySortTs)
    .map(({ activitySortTs: _drop, ...row }) => row);

  const videoRows = avRows.filter((row) => row.sessionType === "video");
  const audioRows = avRows.filter((row) => row.sessionType === "audio");

  const monthCompleted = completedAll.filter((row) => {
    if (!row.scheduled_at) return false;
    const when = new Date(row.scheduled_at);
    return when >= monthStart && when < nextMonthStart;
  });
  const monthSnapshot = computeEarningsSnapshot(
    monthCompleted,
    now.toLocaleDateString("en-GB", { month: "long" }),
  );

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) /
        ratings.length
      : null;

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const availabilityLines = availability.map((row) => {
    const start = String(row.start_time).slice(0, 5);
    const end = String(row.end_time).slice(0, 5);
    return `${DAY_NAMES[row.day_of_week] ?? "Day"} ${start}-${end}`;
  });

  const pricingSummary = services.map((service) => {
    const rates: string[] = [];
    if (service.offers_messaging && service.messaging_flat_rate != null) {
      rates.push(`Messaging: ${formatGbp(Number(service.messaging_flat_rate))} flat`);
    }
    if (service.offers_audio && service.audio_hourly_rate != null) {
      rates.push(`Audio: ${formatGbp(Number(service.audio_hourly_rate))} / hr`);
    }
    if (service.offers_video && service.video_hourly_rate != null) {
      rates.push(`Video: ${formatGbp(Number(service.video_hourly_rate))} / hr`);
    }
    return {
      id: String(service.id),
      name: String(service.name ?? "Service"),
      isActive: service.is_active === true,
      rates,
    };
  });

  const recentPayouts = paidPayouts.map((row) => {
    const totalPence = toPence(row.total_amount);
    const feePence = toPence(row.platform_fee);
    const payoutPence = Math.max(0, totalPence - feePence);
    return {
      id: String(row.id),
      dateLabel: new Date(String(row.created_at)).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      amountGbp: payoutPence / 100,
    };
  });

  const firstName =
    (profile.full_name?.trim() || "Sensei").split(/\s+/)[0] ?? "Sensei";
  const monthYearLabel = now.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const greetingPeriod = greetingForHour(now.getHours());

  const clientData = {
    header: {
      greeting: `Good ${greetingPeriod}, ${firstName}`,
      subtitle: `${monthYearLabel} — you have ${weekSessions} sessions this week`,
    },
    stats: [
      {
        label: "THIS MONTH",
        value: formatGbp(monthSnapshot.totalRevenueGbp),
        delta:
          monthSnapshot.totalRevenueGbp > 0
            ? `+${monthSnapshot.sessionCount} completed`
            : undefined,
      },
      {
        label: "SESSIONS",
        value: String(monthSnapshot.sessionCount),
        delta: `+${monthSnapshot.sessionCount} this month`,
      },
      {
        label: "AVG. RATING",
        value:
          avgRating != null && Number.isFinite(avgRating)
            ? `${avgRating.toFixed(1)} ★`
            : "—",
      },
      {
        label: "RESPONSE",
        value: "< 2h",
      },
    ],
    stripeOnboardingComplete: expert.stripe_onboarding_complete === true,
    schedule: {
      video: videoRows,
      audio: audioRows,
      messaging: messagingRows,
      counts: {
        video: videoRows.length,
        audio: audioRows.length,
        messaging: messagingRows.length,
        messagingUnread: messagingRows.filter((row) => row.unread).length,
      },
    },
    earnings: {
      completedBookings: completedAll,
      currentMonthLabel: now.toLocaleDateString("en-GB", { month: "long" }),
      recentPayouts,
    },
    settings: {
      availability: {
        timezone: expert.timezone?.trim() || "UTC",
        lines: availabilityLines,
      },
      profile: {
        bio: String((expert.bio ?? profile.bio ?? "") || "").trim() || null,
        keywords: Array.isArray(expert.keywords)
          ? expert.keywords.map((k: unknown) => String(k))
          : [],
      },
      pricing: pricingSummary,
    },
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#faf9f7]">
      <Navbar />
      <ActiveSessionBanner />
      <DashboardClient {...clientData} />
    </div>
  );
}
