import type { ConsumerBookingCardProps } from "@/components/ConsumerBookingCard";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingListRow = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string;
  session_type: string;
  service_id: string;
  expert_user_id: string;
  consumer_user_id?: string;
  created_at?: string;
  consumer_reviewed?: boolean | null;
  expert_reviewed?: boolean | null;
};

export async function enrichBookingsForConsumerCards(
  supabase: SupabaseClient,
  rows: BookingListRow[],
): Promise<ConsumerBookingCardProps[]> {
  if (!rows.length) return [];

  const expertIds = [...new Set(rows.map((r) => r.expert_user_id))];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, avatar_url")
    .in("user_id", expertIds);

  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .in("id", serviceIds);

  const profileByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p]),
  );
  const serviceById = new Map(
    (services ?? []).map((s) => [s.id as string, s]),
  );

  return rows.map((b) => {
    const p = profileByUser.get(b.expert_user_id);
    const s = serviceById.get(b.service_id);
    const name = p?.full_name?.trim() || "Expert";
    const initials = name
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const openConversationHref =
      (b.session_type === "messaging" ||
        b.session_type === "urgent_messaging") &&
      (b.status === "confirmed" ||
        b.status === "in_progress" ||
        b.status === "completed")
        ? `/messages/${b.id}`
        : undefined;

    return {
      bookingId: b.id,
      expertName: name,
      expertAvatarUrl: p?.avatar_url ?? null,
      expertInitials: initials,
      serviceName: (s?.name as string) ?? "Service",
      sessionType: b.session_type,
      scheduledAt: b.scheduled_at,
      durationMinutes: b.duration_minutes,
      status: b.status,
      showLeaveReviewLink:
        b.status === "completed" && b.consumer_reviewed === false,
      openConversationHref,
    };
  });
}
