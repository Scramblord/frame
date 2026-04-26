import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripeAccountId =
    typeof expert?.stripe_account_id === "string"
      ? expert.stripe_account_id.trim()
      : "";

  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "No Stripe account configured" },
      { status: 400 },
    );
  }

  const link = await stripe.accounts.createLoginLink(stripeAccountId);
  return NextResponse.json({ url: link.url });
}
