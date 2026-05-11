import { adminGateUserId, requireAdminApi } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (userId === adminGateUserId()) {
    return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: bookings, error: listErr } = await admin
    .from("bookings")
    .select("id, status, stripe_payment_intent_id")
    .or(`consumer_user_id.eq.${userId},expert_user_id.eq.${userId}`);

  if (listErr) {
    console.error("admin delete user list bookings", listErr);
    return NextResponse.json({ error: "Could not load bookings" }, { status: 500 });
  }

  for (const row of bookings ?? []) {
    const b = row as { id: string; status: string; stripe_payment_intent_id: string | null };
    const pi = b.stripe_payment_intent_id?.trim();
    if (b.status === "confirmed" && pi) {
      try {
        await stripe.refunds.create(
          { payment_intent: pi },
          { idempotencyKey: `admin-s9x2k-delete-user-refund-${b.id}` },
        );
      } catch (e) {
        console.error("admin delete user refund", b.id, e);
        return NextResponse.json({ error: "Refund could not be completed" }, { status: 502 });
      }
    }
  }

  const { error: delErr } = await admin
    .from("bookings")
    .delete()
    .or(`consumer_user_id.eq.${userId},expert_user_id.eq.${userId}`);

  if (delErr) {
    console.error("admin delete user remove bookings", delErr);
    return NextResponse.json({ error: "Could not remove bookings" }, { status: 500 });
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
  if (delAuthErr) {
    console.error("admin delete user auth", delAuthErr);
    return NextResponse.json({ error: "Could not delete user" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
