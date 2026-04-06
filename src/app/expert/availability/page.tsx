import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AvailabilityClient from "./AvailabilityClient";

export const dynamic = "force-dynamic";

export default async function ExpertAvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!expert) {
    redirect("/expert/setup");
  }

  const { data: rows } = await supabase
    .from("availability")
    .select("id, day_of_week, start_time, end_time, is_active")
    .eq("expert_user_id", user.id)
    .order("day_of_week", { ascending: true });

  const { data: overrideRows } = await supabase
    .from("availability_overrides")
    .select("id, date, is_blocked, start_time, end_time")
    .eq("expert_user_id", user.id)
    .order("date", { ascending: true });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <AvailabilityClient
        initialRows={rows ?? []}
        initialOverrides={overrideRows ?? []}
        timezone={expert.timezone?.trim() || "UTC"}
      />
    </div>
  );
}
