import EnquiryThreadClient from "@/components/enquiries/EnquiryThreadClient";
import {
  bestAutomaticDiscountForService,
  type DiscountRow,
} from "@/lib/discounts";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ConsumerEnquiryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/enquiries/${id}`)}`);
  }

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!enquiry || enquiry.consumer_user_id !== user.id) {
    notFound();
  }

  const [{ data: messages }, { data: offers }, { data: service }, { data: expertProfile }, { data: consumerProfile }, { data: discountRows }] =
    await Promise.all([
      supabase
        .from("enquiry_messages")
        .select("*")
        .eq("enquiry_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("bookings")
        .select(
          "id, status, session_type, scheduled_at, duration_minutes, total_amount, offer_sent_at, offer_expires_at",
        )
        .eq("source_enquiry_id", id)
        .order("offer_sent_at", { ascending: false }),
      supabase.from("services").select("*").eq("id", enquiry.service_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", enquiry.expert_user_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", enquiry.consumer_user_id)
        .maybeSingle(),
      supabase
        .from("discounts")
        .select("*")
        .eq("expert_user_id", enquiry.expert_user_id)
        .eq("is_active", true)
        .is("code", null),
    ]);

  if (!service) {
    notFound();
  }

  const automaticDiscount = bestAutomaticDiscountForService(
    (discountRows ?? []) as DiscountRow[],
    service.id,
    100,
  );

  return (
    <EnquiryThreadClient
      enquiryId={id}
      backHref="/enquiries"
      currentUserId={user.id}
      role="consumer"
      enquiryStatus={enquiry.status}
      service={service}
      expertName={expertProfile?.full_name?.trim() || "Sensei"}
      consumerName={consumerProfile?.full_name?.trim() || "You"}
      expertProfileId={expertProfile?.id ?? null}
      initialMessages={(messages ?? []) as never[]}
      initialOffers={(offers ?? []) as never[]}
      automaticDiscount={automaticDiscount}
    />
  );
}
