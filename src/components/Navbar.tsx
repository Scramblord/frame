import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NavbarCenter from "@/components/NavbarCenter";
import NavbarClient from "@/components/NavbarClient";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { id: string; full_name: string | null } | null = null;
  let hasExpertProfile = false;

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = p;

    const { data: expertRow } = await supabase
      .from("expert_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasExpertProfile = !!expertRow;
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(/\s+/)
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-zinc-900 dark:text-zinc-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-zinc-900 bg-zinc-900 font-mono text-[10px] font-bold tracking-[0.15em] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
              FR
            </span>
            <span className="font-mono text-lg font-bold tracking-[0.35em] sm:text-xl">
              FRAME
            </span>
          </Link>

          <NavbarCenter
            signedIn={!!user}
            hasExpertProfile={hasExpertProfile}
            publicProfileId={profile?.id ?? null}
          />

          <div className="flex shrink-0 items-center justify-end">
            <NavbarClient
              signedIn={!!user}
              fullName={profile?.full_name ?? null}
              initials={initials}
              hasExpertProfile={hasExpertProfile}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
