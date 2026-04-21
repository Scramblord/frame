import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NavbarCenter from "@/components/NavbarCenter";
import NavbarClient from "@/components/NavbarClient";
import BecomeExpertBanner from "@/components/BecomeExpertBanner";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { id: string; full_name: string | null; avatar_url: string | null } | null = null;
  let hasExpertProfile = false;

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
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
    <>
      <header
        id="frame-navbar"
        data-expert-mode="false"
        className="border-b border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur transition-colors dark:border-zinc-800 dark:bg-zinc-950/90 data-[expert-mode=true]:border-zinc-700/90 data-[expert-mode=true]:bg-gray-900 data-[expert-mode=true]:[&_a]:text-zinc-200 data-[expert-mode=true]:[&_a:hover]:text-white data-[expert-mode=true]:[&_nav_a]:rounded-full data-[expert-mode=true]:[&_nav_a]:px-3 data-[expert-mode=true]:[&_nav_a]:py-2 data-[expert-mode=true]:[&_nav_a]:!text-zinc-200 data-[expert-mode=true]:[&_nav_a:hover]:!bg-white/10 data-[expert-mode=true]:[&_nav_a:hover]:!text-white data-[expert-mode=true]:[&_nav_a[data-active='true']]:bg-white/10 data-[expert-mode=true]:[&_nav_a[data-active='true']]:!text-white data-[expert-mode=true]:[&_.sensei-wordmark-light]:hidden data-[expert-mode=true]:[&_.sensei-wordmark-dark]:block"
      >
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              id="frame-navbar-home-link"
              href="/"
              className="flex shrink-0 items-center gap-2 text-zinc-900 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-50 dark:focus-visible:ring-zinc-500/70 dark:focus-visible:ring-offset-zinc-950"
            >
              <img
                src="/Asset 4@3x.png"
                alt=""
                className="h-8 w-auto shrink-0"
                width={32}
                height={32}
              />
              <img
                src="/Asset 5@3x.png"
                alt="Sensei"
                className="sensei-wordmark-light h-5 w-auto shrink-0"
                width={132}
                height={20}
              />
              <img
                src="/Asset 6@3x.png"
                alt="Sensei"
                className="sensei-wordmark-dark hidden h-5 w-auto shrink-0"
                width={132}
                height={20}
              />
            </Link>

            <NavbarCenter
              signedIn={!!user}
            />

            <div className="flex shrink-0 items-center justify-end">
              <NavbarClient
                signedIn={!!user}
                fullName={profile?.full_name ?? null}
                initials={initials}
                avatarUrl={profile?.avatar_url ?? null}
                hasExpertProfile={hasExpertProfile}
              />
            </div>
          </div>
          <NavbarCenter signedIn={!!user} mobile />
        </div>
      </header>
      <BecomeExpertBanner
        signedIn={!!user}
        hasExpertProfile={hasExpertProfile}
      />
    </>
  );
}
