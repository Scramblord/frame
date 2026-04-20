import { MessagingThreadClient } from "./messaging-thread-client";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ bookingId: string }> };

export default async function MessagingPage({ params }: PageProps) {
  const { bookingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/messages/${bookingId}`)}`);
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, session_type, status, messaging_message_count, messaging_closed_at, messaging_closure_requested_at, messaging_sla_deadline, messaging_first_reply_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    redirect("/bookings");
  }

  if (
    booking.consumer_user_id !== user.id &&
    booking.expert_user_id !== user.id
  ) {
    redirect("/bookings");
  }

  if (
    booking.session_type !== "messaging" &&
    booking.session_type !== "urgent_messaging"
  ) {
    redirect("/bookings");
  }

  if (
    booking.status !== "confirmed" &&
    booking.status !== "in_progress" &&
    booking.status !== "completed"
  ) {
    redirect("/bookings");
  }

  const [{ data: expertProfile }, { data: consumerProfile }, { data: serviceRow }, { data: messages }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", booking.expert_user_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", booking.consumer_user_id)
        .maybeSingle(),
      supabase
        .from("services")
        .select("name")
        .eq("id", booking.service_id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, booking_id, sender_id, content, created_at, sender_role")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  const expertDisplayName = expertProfile?.full_name?.trim() || "Expert";
  const consumerDisplayName = consumerProfile?.full_name?.trim() || "You";
  const serviceName = serviceRow?.name ?? "Service";
  const role =
    user.id === booking.consumer_user_id
      ? ("consumer" as const)
      : ("expert" as const);

  const sessionTypeLabel =
    booking.session_type === "urgent_messaging"
      ? ("Urgent messaging" as const)
      : ("Messaging" as const);

  const backHref =
    role === "consumer" ? `/bookings/${bookingId}` : `/expert/bookings/${bookingId}`;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 dark:bg-zinc-950">
      <Navbar />
      <MessagingThreadClient
        bookingId={bookingId}
        backHref={backHref}
        currentUserId={user.id}
        role={role}
        expertDisplayName={expertDisplayName}
        consumerDisplayName={consumerDisplayName}
        serviceName={serviceName}
        sessionTypeLabel={sessionTypeLabel}
        bookingStatus={booking.status}
        initialMessages={messages ?? []}
        initialMeta={{
          messaging_message_count: booking.messaging_message_count ?? 0,
          messaging_closed_at: booking.messaging_closed_at,
          messaging_closure_requested_at: booking.messaging_closure_requested_at,
          messaging_sla_deadline: booking.messaging_sla_deadline,
          messaging_first_reply_at: booking.messaging_first_reply_at,
        }}
      />
    </div>
  );
}
