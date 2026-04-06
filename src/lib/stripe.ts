import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

/** Server-only Stripe client — use from Route Handlers and Server Actions only. */
export const stripe = new Stripe(secret, {
  typescript: true,
});

/**
 * Absolute origin for Stripe Account Link URLs (refresh_url / return_url).
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://frame.example.com).
 */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}
