"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RoleChoice = "consumer" | "expert";

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleChoice>("consumer");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      router.replace(
        existing.role === "expert" ? "/expert/setup" : "/dashboard",
      );
      return;
    }
    const metaName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "";
    if (metaName) setFullName(metaName);
    setReady(true);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("Please enter your full name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      setSubmitting(false);
      return;
    }
    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: user.id,
      full_name: trimmed,
      role,
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    router.replace(role === "expert" ? "/expert/setup" : "/dashboard");
  }

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-6 py-16 dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(113 113 122 / 0.35) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/40 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl border-2 border-zinc-900 bg-zinc-900 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
              <span className="font-mono text-xs font-bold tracking-[0.2em]">
                FR
              </span>
            </div>
            <h1 className="font-mono text-4xl font-bold tracking-[0.35em] text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              FRAME
            </h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Welcome — tell us how you&apos;ll use the marketplace
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/20"
                placeholder="Alex Morgan"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                I&apos;m joining as
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("consumer")}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    role === "consumer"
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500"
                  }`}
                >
                  <span className="block font-semibold">Consumer</span>
                  <span
                    className={`mt-1 block text-xs ${
                      role === "consumer"
                        ? "text-zinc-300 dark:text-zinc-600"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Book sessions with experts
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("expert")}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    role === "expert"
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500"
                  }`}
                >
                  <span className="block font-semibold">Expert</span>
                  <span
                    className={`mt-1 block text-xs ${
                      role === "expert"
                        ? "text-zinc-300 dark:text-zinc-600"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Offer sessions to clients
                  </span>
                </button>
              </div>
            </fieldset>

            {error ? (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-300"
            >
              {submitting ? "Saving…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
