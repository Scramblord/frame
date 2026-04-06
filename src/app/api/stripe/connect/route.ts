import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Creates or reuses a Stripe Connect Express account, persists stripe_account_id,
 * and returns an Account Link URL for hosted onboarding.
 * return_url hits /api/stripe/connect/return (server updates onboarding flag) then redirects to /expert/connect?success=true
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: expert, error: expertErr } = await supabase
    .from("expert_profiles")
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (expertErr) {
    return NextResponse.json(
      { error: "Failed to load expert profile" },
      { status: 500 },
    );
  }

  if (!expert) {
    return NextResponse.json(
      { error: "Expert profile required. Complete setup first." },
      { status: 403 },
    );
  }

  let accountId = expert.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;

    const { error: updErr } = await supabase
      .from("expert_profiles")
      .update({ stripe_account_id: accountId })
      .eq("user_id", user.id);

    if (updErr) {
      return NextResponse.json(
        { error: "Could not save Stripe account" },
        { status: 500 },
      );
    }
  }

  const origin = getAppOrigin();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/expert/connect`,
    return_url: `${origin}/api/stripe/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
