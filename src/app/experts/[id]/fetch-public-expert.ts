import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPublicExpertUuid(id: string) {
  return UUID_RE.test(id);
}

const PROFILE_SELECT =
  "id, user_id, full_name, avatar_url, location, role" as const;

export type PublicExpertProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  role: string;
};

export type ExpertDetailsRow = Record<string, unknown> & {
  bio?: string | null;
  keywords?: string[] | null;
  timezone?: string | null;
  min_session_minutes?: number | null;
  max_session_minutes?: number | null;
  offers_messaging?: boolean | null;
  messaging_flat_rate?: number | string | null;
  offers_audio?: boolean | null;
  offers_video?: boolean | null;
  audio_hourly_rate?: number | string | null;
  video_hourly_rate?: number | string | null;
};

export async function loadPublicExpertPageData(id: string) {
  const supabase = await createClient();

  let profile: PublicExpertProfileRow | null = null;

  const byProfileId = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", id)
    .eq("role", "expert")
    .maybeSingle();

  if (byProfileId.data) {
    profile = byProfileId.data as PublicExpertProfileRow;
  }

  if (!profile) {
    const byExpertPk = await supabase
      .from("expert_profiles")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (byExpertPk.data?.user_id) {
      const p = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", byExpertPk.data.user_id)
        .eq("role", "expert")
        .maybeSingle();
      if (p.data) profile = p.data as PublicExpertProfileRow;
    }
  }

  if (!profile) {
    const byUserId = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("user_id", id)
      .eq("role", "expert")
      .maybeSingle();

    if (byUserId.data) profile = byUserId.data as PublicExpertProfileRow;
  }

  if (!profile) {
    return { supabase, profile: null, expert: null as ExpertDetailsRow | null };
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("*")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  return {
    supabase,
    profile,
    expert: (expert ?? null) as ExpertDetailsRow | null,
  };
}
