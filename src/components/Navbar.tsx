import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NavbarClient from "@/components/NavbarClient";
import BecomeExpertBanner from "@/components/BecomeExpertBanner";
import NavModeLinks from "@/components/NavModeLinks";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null = null;
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
  const senseiHref = hasExpertProfile ? "/expert/dashboard" : "/expert/setup";

  return (
    <>
      <header
        id="frame-navbar"
        data-expert-mode="false"
        className="border-b border-[var(--color-border)] bg-white text-sm transition-colors [&_.sensei-wordmark-dark]:hidden [&_[id='frame-navbar-home-link']]:text-[var(--color-text)] data-[expert-mode=true]:border-transparent data-[expert-mode=true]:bg-[var(--color-navbar-dark)] data-[expert-mode=true]:[&_.sensei-wordmark-light]:hidden data-[expert-mode=true]:[&_.sensei-wordmark-dark]:block data-[expert-mode=true]:[&_[id='frame-navbar-home-link']]:text-[var(--color-navbar-dark-text)]"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            id="frame-navbar-home-link"
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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

          <div className="flex shrink-0 items-center justify-end">
            {user ? <NavModeLinks senseiHref={senseiHref} /> : null}
            <NavbarClient
              signedIn={!!user}
              fullName={profile?.full_name ?? null}
              initials={initials}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </div>
      </header>
      <BecomeExpertBanner
        signedIn={!!user}
        hasExpertProfile={hasExpertProfile}
      />
    </>
  );
}
