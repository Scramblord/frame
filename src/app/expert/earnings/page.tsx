import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import Navbar from "@/components/Navbar";
import SyncSenseiModeOnMount from "@/components/SyncSenseiModeOnMount";
import { fetchExpertStripeEarnings } from "@/lib/expert-stripe-earnings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import StripeDashboardLink from "./StripeDashboardLink";

export const dynamic = "force-dynamic";

type CompletedBookingRow = {
  id: string;
  total_amount: number | string | null;
  platform_fee: number | string | null;
  session_type: string;
  completed_at: string | null;
};

function toAmount(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatGbpWhole(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ExpertEarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!expert) {
    redirect("/expert/setup");
  }

  const stripeAccountId =
    typeof expert.stripe_account_id === "string"
      ? expert.stripe_account_id.trim()
      : "";
  const isStripeConnected =
    expert.stripe_onboarding_complete === true && Boolean(stripeAccountId);

  const stripeEarnings = isStripeConnected
    ? await fetchExpertStripeEarnings(stripeAccountId)
    : null;

  const { data: completedBookingsRows } = await supabase
    .from("bookings")
    .select("id, total_amount, platform_fee, session_type, completed_at")
    .eq("expert_user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const completedBookings = (completedBookingsRows ?? []) as CompletedBookingRow[];
  const totalCompletedAmount = completedBookings.reduce(
    (sum, b) => sum + toAmount(b.total_amount),
    0,
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const thisMonthTotal = completedBookings.reduce((sum, b) => {
    if (!b.completed_at) return sum;
    const ms = new Date(b.completed_at).getTime();
    if (ms < monthStart || ms >= monthEnd) return sum;
    return sum + toAmount(b.total_amount);
  }, 0);

  const byType = {
    video: { icon: "\u{1F4F9}", label: "Video", count: 0, total: 0 },
    audio: { icon: "\u{1F4DE}", label: "Audio", count: 0, total: 0 },
    messaging: { icon: "\u{1F4AC}", label: "Messaging", count: 0, total: 0 },
  };

  for (const b of completedBookings) {
    const amount = toAmount(b.total_amount);
    if (b.session_type === "video") {
      byType.video.count += 1;
      byType.video.total += amount;
    } else if (b.session_type === "audio") {
      byType.audio.count += 1;
      byType.audio.total += amount;
    } else if (
      b.session_type === "messaging" ||
      b.session_type === "urgent_messaging"
    ) {
      byType.messaging.count += 1;
      byType.messaging.total += amount;
    }
  }

  const rows = [byType.video, byType.audio, byType.messaging];
  const fullName = profile.full_name?.trim() || "Sensei";

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--color-bg)]">
      <Navbar />
      <SyncSenseiModeOnMount senseiMode />
      <ActiveSessionBanner />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-10 sm:px-6">
        <header>
          <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Earnings
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your revenue and payout history
          </p>
        </header>

        {!isStripeConnected ? (
          <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              Connect Stripe to receive payouts
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Sensei uses Stripe to send your earnings directly to your bank
              account.
            </p>
            <Link
              href="/expert/connect"
              className="mt-4 inline-flex rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Connect Stripe
            </Link>
          </section>
        ) : (
          <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Stripe account connected
              </p>
              <StripeDashboardLink />
            </div>
          </section>
        )}

        {isStripeConnected && stripeEarnings?.ok ? (
          <>
            <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Overview</h2>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Available
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {formatGbp(stripeEarnings.data.availablePence / 100)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Ready to pay out
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Pending
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {formatGbp(stripeEarnings.data.pendingPence / 100)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    On the way
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Lifetime
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {formatGbp(stripeEarnings.data.lifetimePence / 100)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    All time earnings
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    This month
                  </p>
                  <p className="text-lg font-semibold text-[var(--color-text)]">
                    {formatGbp(stripeEarnings.data.thisMonthPence / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Last month
                  </p>
                  <p className="text-lg font-semibold text-[var(--color-text)]">
                    {formatGbp(stripeEarnings.data.lastMonthPence / 100)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Breakdown</h2>
              <p className="mb-4 text-sm text-[var(--color-text-muted)]">
                By session format, all time
              </p>
              <div className="space-y-4">
                {rows.map((row) => {
                  const pct =
                    totalCompletedAmount > 0
                      ? Math.round((row.total / totalCompletedAmount) * 100)
                      : 0;
                  return (
                    <div key={row.label}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm text-[var(--color-text)]">
                          <span className="mr-2">{row.icon}</span>
                          <span className="font-medium">{row.label}</span>
                          <span className="ml-2 text-[var(--color-text-muted)]">
                            {row.count} sessions
                          </span>
                        </p>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {formatGbpWhole(row.total)}
                        </p>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 rounded-full bg-[var(--color-accent)] opacity-70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-xl font-bold text-[var(--color-text)]">
                Payout history
              </h2>
              {stripeEarnings.data.recentTransfers.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                  No payouts yet.
                </p>
              ) : (
                <ul className="mt-4">
                  {stripeEarnings.data.recentTransfers.map((transfer) => (
                    <li
                      key={transfer.id}
                      className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0"
                    >
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {new Date(transfer.created * 1000).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text)]">
                        {formatGbp(transfer.amountPence / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                Showing last 5 payouts. Full history available in your Stripe
                dashboard.{" "}
                <a
                  href="https://connect.stripe.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Open Stripe
                </a>
              </p>
            </section>
          </>
        ) : null}

        {!isStripeConnected ? (
          <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-xl font-bold text-[var(--color-text)]">Breakdown</h2>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              By session format, all time
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Connect Stripe to view payout-linked earnings metrics.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
