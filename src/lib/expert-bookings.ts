import type { ExpertBookingCardProps } from "@/components/ExpertBookingCard";
import type { BookingListRow } from "@/lib/consumer-bookings";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enrichBookingsForExpertCards(
  supabase: SupabaseClient,
  rows: BookingListRow[],
): Promise<ExpertBookingCardProps[]> {
  if (!rows.length) return [];

  const consumerIds = [
    ...new Set(
      rows
        .map((r) => r.consumer_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .in("user_id", consumerIds);

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
    const consumerId = b.consumer_user_id;
    const p = consumerId ? profileByUser.get(consumerId) : undefined;
    const s = serviceById.get(b.service_id);
    const name = p?.full_name?.trim() || "Client";
    const initials = name
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      bookingId: b.id,
      consumerName: name,
      consumerAvatarUrl: p?.avatar_url ?? null,
      consumerInitials: initials,
      serviceName: (s?.name as string) ?? "Service",
      sessionType: b.session_type,
      scheduledAt: b.scheduled_at,
      durationMinutes: b.duration_minutes,
      status: b.status,
    };
  });
}
