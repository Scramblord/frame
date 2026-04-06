import { BookWizard } from "./book-wizard";
import type { BookableSessionType } from "@/lib/booking-pricing";
import { createClient } from "@/lib/supabase/server";
import type { ServiceRow } from "@/lib/experts-marketplace";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ expertProfileId: string; serviceId: string }>;
  searchParams: Promise<{ type?: string }>;
};

function parseInitialSessionType(
  raw: string | undefined,
): BookableSessionType | null {
  if (
    raw === "messaging" ||
    raw === "urgent_messaging" ||
    raw === "audio" ||
    raw === "video"
  ) {
    return raw;
  }
  return null;
}

export default async function BookServicePage({ params, searchParams }: PageProps) {
  const { expertProfileId, serviceId } = await params;
  const { type: typeParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/book/${expertProfileId}/${serviceId}`)}`,
    );
  }

  const { data: expertConsumerProfile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("id", expertProfileId)
    .maybeSingle();

  if (pErr || !expertConsumerProfile) {
    notFound();
  }

  const expertUserId = expertConsumerProfile.user_id;

  if (expertUserId === user.id) {
    redirect("/expert/dashboard");
  }

  const { data: service, error: sErr } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("expert_user_id", expertUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (sErr || !service) {
    notFound();
  }

  const { data: expertRow } = await supabase
    .from("expert_profiles")
    .select("timezone")
    .eq("user_id", expertUserId)
    .maybeSingle();

  const expertTimezone =
    (expertRow?.timezone as string | null)?.trim() || "Europe/London";

  const initialSessionType = parseInitialSessionType(typeParam);

  return (
    <BookWizard
      expertProfileId={expertProfileId}
      expertName={expertConsumerProfile.full_name?.trim() || "Expert"}
      expertUserId={expertUserId}
      expertTimezone={expertTimezone}
      service={service as ServiceRow & {
        urgent_messaging_enabled?: boolean;
        urgent_messaging_rate?: number | string | null;
      }}
      initialSessionType={initialSessionType}
    />
  );
}
