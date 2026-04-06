import { SessionRoomClient } from "./session-room-client";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ bookingId: string }> };

export default async function SessionPage({ params }: PageProps) {
  const { bookingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/session/${bookingId}`)}`,
    );
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("consumer_user_id, expert_user_id, session_type")
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    notFound();
  }

  if (
    booking.consumer_user_id !== user.id &&
    booking.expert_user_id !== user.id
  ) {
    notFound();
  }

  if (booking.session_type !== "audio" && booking.session_type !== "video") {
    redirect(
      booking.expert_user_id === user.id
        ? `/expert/bookings/${bookingId}`
        : `/bookings/${bookingId}`,
    );
  }

  const exitHref =
    booking.expert_user_id === user.id
      ? `/expert/bookings/${bookingId}`
      : `/bookings/${bookingId}`;

  return <SessionRoomClient bookingId={bookingId} exitHref={exitHref} />;
}
