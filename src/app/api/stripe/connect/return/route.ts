import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stripe redirects here after hosted onboarding. We sync account state and send the user to /expert/connect.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = request.nextUrl.origin;
  const connectUrl = new URL("/expert/connect", base);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: expert, error: expertErr } = await supabase
    .from("expert_profiles")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (expertErr || !expert?.stripe_account_id) {
    connectUrl.searchParams.set("error", "no_account");
    return NextResponse.redirect(connectUrl);
  }

  const account = await stripe.accounts.retrieve(expert.stripe_account_id);

  const onboardingComplete =
    account.details_submitted === true && account.payouts_enabled === true;

  const { error: updErr } = await supabase
    .from("expert_profiles")
    .update({ stripe_onboarding_complete: onboardingComplete })
    .eq("user_id", user.id);

  if (updErr) {
    connectUrl.searchParams.set("error", "update_failed");
    return NextResponse.redirect(connectUrl);
  }

  if (onboardingComplete) {
    connectUrl.searchParams.set("success", "true");
  }

  return NextResponse.redirect(connectUrl);
}
