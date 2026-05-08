import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export type NavbarNotificationCounts = {
  consumerEnquiries: number;
  consumerBookings: number;
  expertEnquiries: number;
  expertBookings: number;
};

type Props = {
  userId: string;
  children: (counts: NavbarNotificationCounts) => ReactNode;
};

export default async function NavbarNotifications({ userId, children }: Props) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { count: consumerEnquiries },
    { count: expertEnquiries },
    { count: consumerUpcomingConfirmed },
    { count: expertUpcomingConfirmed },
    { count: expertOfferPending },
  ] = await Promise.all([
    supabase
      .from("enquiries")
      .select("*", { head: true, count: "exact" })
      .eq("consumer_user_id", userId)
      .in("status", ["open", "offer_sent"]),
    supabase
      .from("enquiries")
      .select("*", { head: true, count: "exact" })
      .eq("expert_user_id", userId)
      .in("status", ["open", "offer_sent"]),
    supabase
      .from("bookings")
      .select("*", { head: true, count: "exact" })
      .eq("consumer_user_id", userId)
      .eq("status", "confirmed")
      .or(
        `scheduled_at.gt.${nowIso},and(session_type.in.(messaging,urgent_messaging),scheduled_at.is.null)`,
      ),
    supabase
      .from("bookings")
      .select("*", { head: true, count: "exact" })
      .eq("expert_user_id", userId)
      .eq("status", "confirmed")
      .or(
        `scheduled_at.gt.${nowIso},and(session_type.in.(messaging,urgent_messaging),scheduled_at.is.null)`,
      ),
    supabase
      .from("bookings")
      .select("*", { head: true, count: "exact" })
      .eq("expert_user_id", userId)
      .eq("status", "offer_pending"),
  ]);

  return children({
    consumerEnquiries: consumerEnquiries ?? 0,
    consumerBookings: consumerUpcomingConfirmed ?? 0,
    expertEnquiries: expertEnquiries ?? 0,
    expertBookings: (expertUpcomingConfirmed ?? 0) + (expertOfferPending ?? 0),
  });
}
