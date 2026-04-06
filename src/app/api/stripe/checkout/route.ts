import { gbpToPence } from "@/lib/booking-pricing";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bookingId: string;
  try {
    const json = (await request.json()) as { bookingId?: string };
    bookingId = json.bookingId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, session_type, status, total_amount, platform_fee",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.consumer_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Booking is not awaiting payment" },
      { status: 400 },
    );
  }

  const total = Number(booking.total_amount);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
  }

  const { data: expertProfile, error: epErr } = await supabase
    .from("expert_profiles")
    .select("stripe_account_id")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  if (epErr || !expertProfile?.stripe_account_id) {
    return NextResponse.json(
      {
        error:
          "This expert has not connected payouts yet. Try again later or contact support.",
      },
      { status: 400 },
    );
  }

  const { data: service } = await supabase
    .from("services")
    .select("name")
    .eq("id", booking.service_id)
    .maybeSingle();

  const { data: expertPublicProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  const expertProfilePk = expertPublicProfile?.id;
  const origin = getAppOrigin();
  const successUrl = `${origin}/bookings/${booking.id}?success=true`;
  const cancelPath =
    expertProfilePk != null
      ? `${origin}/book/${expertProfilePk}/${booking.service_id}`
      : `${origin}/dashboard`;

  const amountPence = gbpToPence(total);
  const expertStripeAccountId = expertProfile.stripe_account_id;

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
            name: service?.name
              ? `FRAME — ${service.name}`
              : "FRAME session",
            metadata: {
              booking_id: booking.id,
            },
          },
        },
      },
    ],
    payment_intent_data: {
      metadata: {
        booking_id: booking.id,
        expert_stripe_account_id: expertStripeAccountId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelPath,
    metadata: {
      booking_id: booking.id,
      expert_stripe_account_id: expertStripeAccountId,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create Checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
