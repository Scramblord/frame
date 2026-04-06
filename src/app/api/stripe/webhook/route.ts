import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/** Node runtime — webhooks need raw body (use request.text(), not JSON). */
export const runtime = "nodejs";

/**
 * Stripe sends raw body; signature verification requires the unparsed payload.
 * (Pages Router used `export const config = { api: { bodyParser: false } }`;
 * in the App Router, do not call `request.json()` here.)
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.booking_id;
    const expertStripeAccountId =
      pi.metadata?.expert_stripe_account_id?.trim() || null;
    if (!bookingId) {
      return NextResponse.json({ received: true });
    }

    try {
      const admin = createServiceRoleClient();
      const { error: updErr } = await admin
        .from("bookings")
        .update({
          status: "confirmed",
          stripe_payment_intent_id: pi.id,
          ...(expertStripeAccountId
            ? { expert_stripe_account_id: expertStripeAccountId }
            : {}),
        })
        .eq("id", bookingId)
        .eq("status", "pending_payment");

      if (updErr) {
        console.error("Failed to confirm booking after PI succeeded", updErr);
      }
    } catch (e) {
      console.error("Supabase admin client error (payment_intent)", e);
    }

    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    const expertStripeAccountId =
      session.metadata?.expert_stripe_account_id?.trim() || null;
    if (!bookingId) {
      console.error("checkout.session.completed missing booking_id metadata");
      return NextResponse.json({ received: true });
    }

    let paymentIntentId: string | null = null;
    const pi = session.payment_intent;
    if (typeof pi === "string") {
      paymentIntentId = pi;
    } else if (pi && typeof pi === "object" && "id" in pi) {
      paymentIntentId = (pi as Stripe.PaymentIntent).id;
    }

    if (!paymentIntentId) {
      console.error("No payment_intent on checkout session", session.id);
      return NextResponse.json({ received: true });
    }

    try {
      const admin = createServiceRoleClient();
      const { error: updErr } = await admin
        .from("bookings")
        .update({
          status: "confirmed",
          stripe_payment_intent_id: paymentIntentId,
          expert_stripe_account_id: expertStripeAccountId,
        })
        .eq("id", bookingId)
        .eq("status", "pending_payment");

      if (updErr) {
        console.error("Failed to update booking after payment", updErr);
      }
    } catch (e) {
      console.error("Supabase admin client error", e);
    }
  }

  return NextResponse.json({ received: true });
}
