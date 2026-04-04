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
  title: "Find experts — FRAME",
  description: "Search FRAME experts by topic and speciality.",
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
    <div className="min-h-full flex-1 bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Find an expert
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Search by topic, skill, or speciality.
        </p>

        <form
          action="/search"
          method="get"
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={trimmed}
            placeholder="e.g. jiujitsu, physiotherapy, strength and conditioning…"
            className="w-full flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
            autoComplete="off"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Search
          </button>
        </form>

        {experts.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-8 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/80">
            <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
              No experts match that search
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {trimmed
                ? "Try different words, fewer terms, or browse with an empty search to see everyone."
                : "No expert profiles are available yet. Check back soon."}
            </p>
            {trimmed ? (
              <Link
                href="/search"
                className="mt-6 inline-block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
              >
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
                    className="block rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-md transition hover:border-zinc-300 hover:shadow-lg sm:p-6 dark:border-zinc-700/80 dark:bg-zinc-900 dark:hover:border-zinc-600"
                  >
                    <div className="flex gap-4 sm:gap-5">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                        {profile.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {name}
                            </h2>
                            {matchedServiceName ? (
                              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                  Offers:
                                </span>{" "}
                                {matchedServiceName}
                              </p>
                            ) : null}
                          </div>
                          {fromPrice != null ? (
                            <span className="shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                              From {formatGbp(fromPrice)}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-zinc-400">
                              Pricing on profile
                            </span>
                          )}
                        </div>
                        {tags.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {tags.slice(0, 8).map((tag: string) => (
                              <li
                                key={tag}
                                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                {tag}
                              </li>
                            ))}
                            {tags.length > 8 && (
                              <li className="px-1 text-xs text-zinc-400">
                                +{tags.length - 8} more
                              </li>
                            )}
                          </ul>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {consultTypes.length > 0 ? (
                            consultTypes.map((t) => (
                              <span
                                key={t}
                                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">
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
        )}
      </main>
    </div>
  );
}
