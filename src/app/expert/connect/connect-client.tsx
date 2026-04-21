"use client";

import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function ExpertConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryError = searchParams.get("error");
  const querySuccess = searchParams.get("success");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: expert, error: exErr } = await supabase
      .from("expert_profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", user.id)
      .maybeSingle();

    if (exErr) {
      setError("Could not load your Sensei profile.");
      setLoading(false);
      return;
    }

    if (!expert) {
      router.replace("/expert/setup");
      return;
    }

    setStripeAccountId(expert.stripe_account_id);
    setOnboardingComplete(expert.stripe_onboarding_complete === true);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function startOrContinueOnboarding() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No onboarding URL returned");
    } catch {
      setError("Network error — try again.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </main>
    );
  }

  const hasAccount = Boolean(stripeAccountId);
  const fullyConnected = onboardingComplete;
  const needsContinue = hasAccount && !fullyConnected;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/expert/dashboard"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to Sensei dashboard
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Payouts &amp; bank account
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Connect Stripe so Sensei can pay you when sessions are completed.
        </p>

        {queryError === "no_account" ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            We couldn&apos;t find a Stripe account on your profile. Start the
            connection flow below.
          </p>
        ) : null}
        {queryError === "update_failed" ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            Couldn&apos;t save your onboarding status. Try again or contact
            support.
          </p>
        ) : null}
        {querySuccess === "true" && fullyConnected ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            Stripe onboarding finished — your profile is up to date.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        ) : null}

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          {fullyConnected ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-5 dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                You&apos;re all set to receive payments
              </p>
              <p className="mt-2 text-sm text-emerald-800/90 dark:text-emerald-200/90">
                Your bank account is connected through Stripe. Payouts are sent
                after sessions are marked complete.
              </p>
            </div>
          ) : needsContinue ? (
            <>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                Your Stripe account was created but setup isn&apos;t finished
                yet. Continue to add your details and verify your bank account
                so you can get paid.
              </p>
              <button
                type="button"
                onClick={() => startOrContinueOnboarding()}
                disabled={actionLoading}
                className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {actionLoading ? "Opening Stripe…" : "Continue setup"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                Sensei uses Stripe Connect to send your earnings directly to your
                bank. You&apos;ll complete a short Stripe-hosted flow to verify
                your identity and link a payout account. We don&apos;t store
                your bank details on Sensei.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                You need to connect before you can receive payouts from
                completed sessions.
              </p>
              <button
                type="button"
                onClick={() => startOrContinueOnboarding()}
                disabled={actionLoading}
                className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {actionLoading ? "Opening Stripe…" : "Connect your bank account"}
              </button>
            </>
          )}
        </section>
    </main>
  );
}
