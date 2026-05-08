import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PatchBody = {
  isActive?: boolean;
};

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive required" }, { status: 400 });
  }

  const { data: discount, error: loadErr } = await supabase
    .from("discounts")
    .select("*")
    .eq("id", id)
    .eq("expert_user_id", user.id)
    .maybeSingle();

  if (loadErr || !discount) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  try {
    await stripe.coupons.update(discount.stripe_coupon_id, {
      metadata: {
        is_active: body.isActive ? "true" : "false",
      },
    });
    if (discount.stripe_promotion_code_id) {
      await stripe.promotionCodes.update(discount.stripe_promotion_code_id, {
        active: body.isActive,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe error" },
      { status: 400 },
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("discounts")
    .update({ is_active: body.isActive })
    .eq("id", id)
    .eq("expert_user_id", user.id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Failed to update discount" },
      { status: 500 },
    );
  }

  return NextResponse.json({ discount: updated });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: discount, error: loadErr } = await supabase
    .from("discounts")
    .select("*")
    .eq("id", id)
    .eq("expert_user_id", user.id)
    .maybeSingle();

  if (loadErr || !discount) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  try {
    if (discount.stripe_promotion_code_id) {
      await stripe.promotionCodes.update(discount.stripe_promotion_code_id, {
        active: false,
      });
    }
    await stripe.coupons.del(discount.stripe_coupon_id);
  } catch {
    // Stripe coupons cannot always be deleted after redemption; keep deletion best-effort.
  }

  const { error: deleteErr } = await supabase
    .from("discounts")
    .delete()
    .eq("id", id)
    .eq("expert_user_id", user.id);

  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message ?? "Failed to delete discount" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
