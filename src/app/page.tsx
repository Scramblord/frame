import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import {
  fetchExpertsWithProfiles,
  formatGbp,
  lowestPriceForService,
} from "@/lib/experts-marketplace";

export const metadata: Metadata = {
  title: "Sensei — Book Senseis for live sessions",
  description:
    "Book live video, audio, or messaging sessions with Senseis. Brazilian jiu-jitsu, grappling, physiotherapy, strength & conditioning, and more.",
};

export const dynamic = "force-dynamic";

type FeaturedSensei = {
  userId: string;
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  firstServiceName: string | null;
  ratingAvg: number | null;
  offersMessaging: boolean;
  offersAudio: boolean;
  offersVideo: boolean;
  startingPrice: number | null;
};

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const experts = await fetchExpertsWithProfiles(supabase);
  const expertsWithServices = experts.filter((expert) => {
    const services = expert.services ?? [];
    return services.some((service) => service.is_active !== false);
  });
  const featuredExperts = expertsWithServices.slice(0, 8);
  const featuredUserIds = featuredExperts.map((expert) => expert.user_id);

  const { data: reviewRows } =
    featuredUserIds.length > 0
      ? await supabase
          .from("reviews")
          .select("reviewee_id, rating")
          .in("reviewee_id", featuredUserIds)
      : { data: [] as { reviewee_id: string; rating: number | null }[] };

  const ratingByUserId = new Map<string, number | null>();
  for (const userId of featuredUserIds) {
    const ratings = (reviewRows ?? [])
      .filter((row) => row.reviewee_id === userId && row.rating != null)
      .map((row) => Number(row.rating))
      .filter((value) => Number.isFinite(value));
    if (ratings.length === 0) {
      ratingByUserId.set(userId, null);
      continue;
    }
    const average = ratings.reduce((acc, value) => acc + value, 0) / ratings.length;
    ratingByUserId.set(userId, average);
  }

  const featuredSenseis: FeaturedSensei[] = featuredExperts
    .map((expert) => {
      const profile = expert.profile;
      if (!profile?.id) return null;
      const services = expert.services ?? [];
      const firstService = services[0] ?? null;
      const startingPrice = services
        .map((service) => lowestPriceForService(service))
        .filter((price): price is number => price != null && Number.isFinite(price))
        .reduce<number | null>(
          (lowest, price) => (lowest == null || price < lowest ? price : lowest),
          null,
        );
      return {
        userId: expert.user_id,
        profileId: profile.id,
        fullName: profile.full_name?.trim() || "Sensei",
        avatarUrl: profile.avatar_url,
        firstServiceName: firstService?.name ?? null,
        ratingAvg: ratingByUserId.get(expert.user_id) ?? null,
        offersMessaging: services.some((service) => service.offers_messaging),
        offersAudio: services.some((service) => service.offers_audio),
        offersVideo: services.some((service) => service.offers_video),
        startingPrice,
      };
    })
    .filter((expert): expert is FeaturedSensei => expert !== null);

  const { count: foundingCountRaw } = await supabase
    .from("expert_profiles")
    .select("*", { count: "exact", head: true })
    .eq("stripe_onboarding_complete", true);

  const foundingCount = foundingCountRaw ?? 0;
  const foundingSpotsTarget = 100;
  const foundingProgress = Math.min(
    100,
    Math.round((Math.min(foundingCount, foundingSpotsTarget) / foundingSpotsTarget) * 100),
  );

  const heroSearch = (
    <form action="/search" method="get" className="mt-8 w-full max-w-2xl">
      <label htmlFor="landing-search" className="sr-only">
        Search experts
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          id="landing-search"
          name="q"
          type="search"
          placeholder="Search by skill, name, or topic"
          className="min-h-[52px] w-full flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text)] shadow-[var(--shadow-sm)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-strong)]"
          autoComplete="off"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-[var(--color-accent)] px-8 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Search
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      {user ? (
        <Navbar />
      ) : (
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-[var(--color-text)]">
              <img src="/Asset 4@3x.png" alt="" className="h-8 w-auto shrink-0" width={32} height={32} />
              <img src="/Asset 5@3x.png" alt="Sensei" className="h-5 w-auto shrink-0" width={132} height={20} />
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)]"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <section className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Problems, solved.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
            Book video, audio, or messaging sessions with expert coaches and clinicians — on your schedule.
          </p>
          <div className="mx-auto mt-2 flex w-full max-w-2xl flex-col items-center">
            {heroSearch}
            <p className="mt-3 text-center text-sm text-[var(--color-text-muted)]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[var(--color-text)] underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
                Featured Senseis
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)] sm:text-base">
                BJJ, Physiotherapy, S&amp;C, Grappling — and more on the way
              </p>
            </div>
            <Link href="/search" className="shrink-0 text-sm font-medium text-[var(--color-text)] hover:underline">
              View all →
            </Link>
          </div>

          {featuredSenseis.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
              Featured Senseis will appear here as soon as active services are published.
            </div>
          ) : (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-4">
              {featuredSenseis.map((sensei) => (
                <li
                  key={sensei.userId}
                  className="w-[85%] min-w-[270px] snap-start rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:w-auto md:min-w-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                      {sensei.avatarUrl ? (
                        <Image src={sensei.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-700">
                          {initialsFromName(sensei.fullName)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-[var(--color-text)]">{sensei.fullName}</h3>
                      <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">
                        {sensei.firstServiceName ?? "Service details on profile"}
                      </p>
                      {sensei.ratingAvg != null ? (
                        <p className="mt-2 text-sm font-medium text-[var(--color-text)]">
                          ★ {sensei.ratingAvg.toFixed(1)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                    {sensei.offersVideo ? <span className="rounded-full border border-[var(--color-border)] px-2 py-1">📹 Video</span> : null}
                    {sensei.offersAudio ? <span className="rounded-full border border-[var(--color-border)] px-2 py-1">🎙 Audio</span> : null}
                    {sensei.offersMessaging ? (
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-1">💬 Message</span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {sensei.startingPrice != null ? `From ${formatGbp(sensei.startingPrice)}` : "Pricing on profile"}
                    </p>
                    <Link
                      href={`/experts/${sensei.profileId}`}
                      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
                    >
                      Book
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-16 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">How it works</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <article>
              <p className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-lg">🔍</p>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Find your Sensei</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Search by skill, topic, or name. Browse profiles, read reviews, and compare session formats.
              </p>
            </article>
            <article>
              <p className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-lg">📅</p>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Book a session</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Choose video, audio, or messaging. Pick a time that works for you and pay securely in a few taps.
              </p>
            </article>
            <article>
              <p className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-lg">🎯</p>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Get expert guidance</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Connect live with your Sensei and get the answers you need — on your terms.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-16 rounded-[var(--radius-lg)] bg-[var(--color-navbar-dark)] p-6 text-[var(--color-navbar-dark-text)] shadow-[var(--shadow-md)] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Become a Founding Sensei</h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--color-navbar-dark-muted)] sm:text-base">
            We&apos;re onboarding our first 100 Senseis. Founding Senseis lock in a 5% commission rate for 2 years — half our standard rate. Join the founding cohort before spots run out.
          </p>

          <div className="mt-6 max-w-xl">
            <p className="text-sm font-medium">{foundingCount} of 100 founding spots taken</p>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${foundingProgress}%` }} />
            </div>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-navbar-dark)] transition hover:bg-zinc-100"
          >
            Apply to become a Sensei
          </Link>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-[var(--color-text-muted)] sm:px-6 sm:text-sm">
          <p>© 2026 Sensei. All rights reserved. | Terms | Privacy</p>
          <p>Sensei is a booking platform. We do not employ or endorse any Sensei listed on the platform.</p>
        </div>
      </footer>
    </div>
  );
}
