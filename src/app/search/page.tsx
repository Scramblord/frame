import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find experts — FRAME",
  description: "Search FRAME experts by topic and speciality.",
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function startingPrice(e: {
  offers_messaging?: boolean | null;
  messaging_flat_rate?: number | string | null;
  offers_audio?: boolean | null;
  audio_hourly_rate?: number | string | null;
  offers_video?: boolean | null;
  video_hourly_rate?: number | string | null;
}): number | null {
  const rates: number[] = [];
  if (e.offers_messaging && e.messaging_flat_rate != null)
    rates.push(Number(e.messaging_flat_rate));
  if (e.offers_audio && e.audio_hourly_rate != null)
    rates.push(Number(e.audio_hourly_rate));
  if (e.offers_video && e.video_hourly_rate != null)
    rates.push(Number(e.video_hourly_rate));
  if (!rates.length) return null;
  return Math.min(...rates);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const trimmed = (q ?? "").trim();

  const { data: expertProfiles, error: epError } = await supabase
    .from("expert_profiles")
    .select("*");

  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "expert");

  console.log("expertProfiles:", expertProfiles, epError);
  console.log("profiles:", profiles, pError);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  let experts = (expertProfiles ?? []).map((ep) => ({
    ...ep,
    profile: profileMap.get(ep.user_id),
  })).filter((ep) => ep.profile);

  if (trimmed) {
    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    experts = experts.filter((ep) => {
      const kws = (ep.keywords ?? []).map((k: string) => k.toLowerCase());
      return tokens.some((tok) =>
        kws.some((kw: string) => kw.includes(tok))
      );
    });
  }

  experts.sort((a, b) =>
    (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "")
  );
  return (
    <div className="min-h-full flex-1 bg-gradient-to-b from-zinc-100 to-zinc-200/90">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-zinc-900">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-zinc-900 bg-zinc-900 font-mono text-[10px] font-bold tracking-[0.15em] text-white">
                FR
              </span>
              <span className="font-mono text-lg font-bold tracking-[0.35em] sm:text-xl">
                FRAME
              </span>
            </Link>
            <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Find an expert
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search by topic, skill, or speciality.
        </p>

        <form action="/search" method="get" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={trimmed}
            placeholder="e.g. jiujitsu, physiotherapy, strength and conditioning…"
            className="w-full flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            autoComplete="off"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800"
          >
            Search
          </button>
        </form>

        {experts.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-8 py-14 text-center">
            <p className="text-lg font-medium text-zinc-800">
              No experts match that search
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              {trimmed
                ? "Try different words, fewer terms, or browse with an empty search to see everyone."
                : "No expert profiles are available yet. Check back soon."}
            </p>
            {trimmed ? (
              <Link href="/search" className="mt-6 inline-block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline">
                Clear search
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="mt-10 grid gap-5">
            {experts.map((ep) => {
              const profile = ep.profile;
              if (!profile?.id) return null;
              const name = profile.full_name?.trim() || "Expert";
              const initials = name.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const fromPrice = startingPrice(ep);
              const tags = ep.keywords ?? [];
              const consultTypes: string[] = [];
              if (ep.offers_messaging) consultTypes.push("Messaging");
              if (ep.offers_audio) consultTypes.push("Audio");
              if (ep.offers_video) consultTypes.push("Video");

              return (
                <li key={ep.user_id}>
                  <Link
                    href={`/experts/${profile.id}`}
                    className="block rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-md transition hover:border-zinc-300 hover:shadow-lg sm:p-6"
                  >
                    <div className="flex gap-4 sm:gap-5">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                        {profile.avatar_url ? (
                          <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="64px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h2 className="text-lg font-semibold text-zinc-900">{name}</h2>
                          {fromPrice != null ? (
                            <span className="shrink-0 text-sm font-semibold text-zinc-700">
                              From {formatGbp(fromPrice)}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-zinc-400">Pricing on profile</span>
                          )}
                        </div>
                        {tags.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {tags.slice(0, 8).map((tag: string) => (
                              <li key={tag} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                                {tag}
                              </li>
                            ))}
                            {tags.length > 8 && (
                              <li className="px-1 text-xs text-zinc-400">+{tags.length - 8} more</li>
                            )}
                          </ul>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {consultTypes.length > 0 ? (
                            consultTypes.map((t) => (
                              <span key={t} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">Consultation types on profile</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}