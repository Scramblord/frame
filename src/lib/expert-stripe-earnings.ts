import { stripe } from "@/lib/stripe";

export type ExpertStripeEarnings = {
  availablePence: number;
  pendingPence: number;
  lifetimePence: number;
  thisMonthPence: number;
  lastMonthPence: number;
  recentTransfers: Array<{
    id: string;
    amountPence: number;
    created: number;
  }>;
};

function sumGbpPence(
  items: Array<{ amount?: number | null; currency?: string }> | undefined,
): number {
  if (!items?.length) return 0;
  return items
    .filter((b) => b.currency === "gbp")
    .reduce((sum, b) => sum + (b.amount ?? 0), 0);
}

function utcMonthRange(
  year: number,
  monthIndex0: number,
): { startSec: number; endSec: number } {
  const startSec = Math.floor(
    Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0) / 1000,
  );
  const endSec = Math.floor(
    Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999) / 1000,
  );
  return { startSec, endSec };
}

/**
 * Fetches Connect balance and transfers for an expert's Stripe account.
 * All Stripe amounts are in the smallest currency unit (pence for GBP).
 */
export async function fetchExpertStripeEarnings(
  stripeAccountId: string,
): Promise<{ ok: true; data: ExpertStripeEarnings } | { ok: false }> {
  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId },
    );

    const availablePence = sumGbpPence(balance.available);
    const pendingPence = sumGbpPence(balance.pending);

    const transfers = await stripe.transfers.list({
      destination: stripeAccountId,
      limit: 100,
    });

    const gbpTransfers = transfers.data.filter((t) => t.currency === "gbp");

    const sorted = [...gbpTransfers].sort((a, b) => b.created - a.created);

    const lifetimePence = gbpTransfers.reduce((s, t) => s + (t.amount ?? 0), 0);

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const thisR = utcMonthRange(y, m);
    const lastMonthIdx = m === 0 ? 11 : m - 1;
    const lastYear = m === 0 ? y - 1 : y;
    const lastR = utcMonthRange(lastYear, lastMonthIdx);

    let thisMonthPence = 0;
    let lastMonthPence = 0;
    for (const t of gbpTransfers) {
      const c = t.created;
      if (c >= thisR.startSec && c <= thisR.endSec) {
        thisMonthPence += t.amount ?? 0;
      }
      if (c >= lastR.startSec && c <= lastR.endSec) {
        lastMonthPence += t.amount ?? 0;
      }
    }

    const recentTransfers = sorted.slice(0, 5).map((t) => ({
      id: t.id,
      amountPence: t.amount ?? 0,
      created: t.created,
    }));

    return {
      ok: true,
      data: {
        availablePence,
        pendingPence,
        lifetimePence,
        thisMonthPence,
        lastMonthPence,
        recentTransfers,
      },
    };
  } catch (e) {
    console.error("fetchExpertStripeEarnings failed", e);
    return { ok: false };
  }
}
