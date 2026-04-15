import { gbpToPence } from "@/lib/booking-pricing";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResumePaymentBody = {
  bookingId?: string;
};

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }
  if (paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent) {
    return paymentIntent.id;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bookingId = "";
  try {
    const body = (await request.json()) as ResumePaymentBody;
    bookingId = body.bookingId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, status, total_amount, platform_fee",
    )
    .eq("id", bookingId)
    .eq("consumer_user_id", user.id)
    .eq("status", "pending_payment")
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: service, error: serviceErr } = await supabase
    .from("services")
    .select("id, name")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceErr || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const { data: expertProfile, error: expertErr } = await supabase
    .from("expert_profiles")
    .select("stripe_account_id")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  if (expertErr || !expertProfile?.stripe_account_id) {
    return NextResponse.json(
      { error: "Expert payout account is not configured" },
      { status: 400 },
    );
  }

  const totalAmount = Number(booking.total_amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
  }

  const platformFeeRaw = Number(booking.platform_fee);
  const platformFee =
    Number.isFinite(platformFeeRaw) && platformFeeRaw > 0 ? platformFeeRaw : 0;

  const amountPence = gbpToPence(totalAmount);
  const feePence = gbpToPence(platformFee);
  const origin = getAppOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amountPence,
          product_data: {
            name: service.name ? `FRAME — ${service.name}` : "FRAME session",
            metadata: {
              booking_id: booking.id,
            },
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: feePence > 0 ? feePence : undefined,
      transfer_data: {
        destination: expertProfile.stripe_account_id,
      },
      metadata: {
        booking_id: booking.id,
        expert_stripe_account_id: expertProfile.stripe_account_id,
      },
    },
    success_url: `${origin}/bookings/${booking.id}?payment=success`,
    cancel_url: `${origin}/bookings`,
    metadata: {
      booking_id: booking.id,
      expert_stripe_account_id: expertProfile.stripe_account_id,
    },
    expand: ["payment_intent"],
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create Checkout session" },
      { status: 500 },
    );
  }

  const paymentIntentId = getPaymentIntentId(session);
  if (paymentIntentId) {
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq("id", booking.id)
      .eq("consumer_user_id", user.id)
      .eq("status", "pending_payment");

    if (updateErr) {
      return NextResponse.json(
        { error: "Could not update booking payment intent" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ url: session.url });
}
