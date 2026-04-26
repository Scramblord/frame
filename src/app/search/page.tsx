import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import {
  fetchExpertsWithProfiles,
  formatGbp,
  matchingServiceNameForSearch,
  startingPrice,
} from "@/lib/experts-marketplace";

export const metadata: Metadata = {
  title: "Find Senseis — Sensei",
  description: "Search Sensei guides by topic and speciality.",
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const trimmed = (q ?? "").trim();

  const experts = await fetchExpertsWithProfiles(supabase, trimmed);

  return (
    <div className="min-h-screen flex-1 bg-[var(--color-bg)]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Find a Sensei
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Search by topic, skill, or speciality.
        </p>

        <form
          action="/search"
          method="get"
          className="flex h-14 items-center rounded-xl border border-[var(--color-border)] bg-white px-2 shadow-[var(--shadow-sm)]"
        >
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={trimmed}
            placeholder="e.g. jiujitsu, physiotherapy, strength and conditioning…"
            className="h-full w-full border-0 bg-transparent px-3 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)]"
            autoComplete="off"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Search
          </button>
        </form>

        {experts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {trimmed
                ? `No Senseis found for "${trimmed}". Try a different search.`
                : "No Senseis found for ''. Try a different search."}
            </p>
          </div>
        ) : (
          <section className="mt-8">
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              {experts.length} Senseis found
            </p>
            <ul className="grid gap-4">
            {experts.map((ep) => {
              const profile = ep.profile;
              if (!profile?.id) return null;
              const name = profile.full_name?.trim() || "Sensei";
              const initials = name
                .split(/\s+/)
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const fromPrice = startingPrice(ep);
              const tags = ep.keywords ?? [];
              const svcs = ep.services ?? [];
              const consultTypes: string[] = [];
              if (svcs.some((s) => s.offers_messaging))
                consultTypes.push("Messaging");
              if (svcs.some((s) => s.offers_audio)) consultTypes.push("Audio");
              if (svcs.some((s) => s.offers_video)) consultTypes.push("Video");

              const matchedServiceName = trimmed
                ? matchingServiceNameForSearch(ep, trimmed)
                : null;

              return (
                <li key={ep.user_id as string}>
                  <Link
                    href={`/experts/${profile.id}`}
                    className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)]"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                        {profile.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="44px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-700">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-[var(--color-text)]">
                              {name}
                            </h2>
                            {matchedServiceName ? (
                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                <span className="font-medium text-[var(--color-text)]">
                                  Offers:
                                </span>{" "}
                                {matchedServiceName}
                              </p>
                            ) : null}
                          </div>
                          {fromPrice != null ? (
                            <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
                              From {formatGbp(fromPrice)}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                              Pricing on profile
                            </span>
                          )}
                        </div>
                        {tags.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {tags.slice(0, 4).map((tag: string) => (
                              <li
                                key={tag}
                                className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                              >
                                {tag}
                              </li>
                            ))}
                            {tags.length > 4 && (
                              <li className="px-1 text-xs text-[var(--color-text-muted)]">
                                +{tags.length - 4} more
                              </li>
                            )}
                          </ul>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {consultTypes.length > 0 ? (
                            consultTypes.map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              Consultation types on profile
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
