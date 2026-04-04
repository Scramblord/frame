import Link from "next/link";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FRAME — Book experts for live sessions",
  description:
    "Book live video, audio, or messaging sessions with experts. Brazilian jiu-jitsu, grappling, physiotherapy, strength & conditioning, and more.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const heroSearch = (
    <form action="/search" method="get" className="mt-8 w-full max-w-xl">
      <label htmlFor="landing-search" className="sr-only">
        Search experts
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          id="landing-search"
          name="q"
          type="search"
          placeholder="Try BJJ, physio, S&C…"
          className="min-h-[52px] w-full flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
          autoComplete="off"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Search
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-zinc-100 via-white to-zinc-100/90 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/90">
      {user ? (
        <Navbar />
      ) : (
        <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-zinc-900 bg-zinc-900 font-mono text-[10px] font-bold tracking-[0.15em] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
                FR
              </span>
              <span className="font-mono text-lg font-bold tracking-[0.35em] sm:text-xl">
                FRAME
              </span>
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Live expertise, on your terms
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Book video, audio, or messaging sessions with experts
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            FRAME connects you with coaches and clinicians for one-to-one
            sessions — pick the format that fits, book a slot, and get guidance
            when you need it.
          </p>
        </div>

        <div className="mx-auto mt-2 flex w-full max-w-xl flex-col items-center">
          {heroSearch}
          {!user ? (
            <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-zinc-800 underline-offset-4 hover:underline dark:text-zinc-200"
              >
                Sign in
              </Link>
            </p>
          ) : null}
        </div>

        <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/60 sm:p-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Launch focus
          </h2>
          <p className="mt-3 text-center text-zinc-700 dark:text-zinc-300">
            We&apos;re opening with experts in{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Brazilian jiu-jitsu
            </span>
            ,{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              grappling
            </span>
            ,{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              physiotherapy
            </span>
            , and{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              strength &amp; conditioning
            </span>
            — with more specialities on the way.
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Experts set their own rates and availability. Browse by keyword,
            compare formats, and book in a few clicks.
          </p>
        </section>
      </main>
    </div>
  );
}
