import { gbpToPence } from "@/lib/booking-pricing";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateDiscountBody = {
  serviceId: string | null;
  discountType: "percentage" | "fixed";
  amount: number;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  maxUses: number | null;
  isActive: boolean;
};

function normalizeCode(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: discounts, error: dErr }, { data: services, error: sErr }] =
    await Promise.all([
      supabase
        .from("discounts")
        .select("*")
        .eq("expert_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, name, is_active")
        .eq("expert_user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

  if (dErr || sErr) {
    return NextResponse.json(
      { error: dErr?.message ?? sErr?.message ?? "Failed to load discounts" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    discounts: discounts ?? [],
    services: services ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateDiscountBody;
  try {
    body = (await request.json()) as CreateDiscountBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.discountType !== "percentage" && body.discountType !== "fixed") {
    return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }
  if (body.discountType === "percentage" && amount > 100) {
    return NextResponse.json(
      { error: "Percentage discounts cannot exceed 100" },
      { status: 400 },
    );
  }

  const normalizedCode = normalizeCode(body.code);
  const serviceId = body.serviceId?.trim() || null;
  const startDate = body.startDate?.trim() || null;
  const endDate = body.endDate?.trim() || null;
  const maxUses =
    body.maxUses == null ? null : Math.max(0, Math.trunc(Number(body.maxUses)));
  const isActive = body.isActive !== false;

  if (maxUses != null && maxUses <= 0) {
    return NextResponse.json(
      { error: "Max uses must be greater than zero" },
      { status: 400 },
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }
  }

  if (serviceId) {
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id")
      .eq("id", serviceId)
      .eq("expert_user_id", user.id)
      .maybeSingle();
    if (svcErr || !service) {
      return NextResponse.json({ error: "Invalid service scope" }, { status: 400 });
    }
  }

  let couponId: string | null = null;
  let promotionCodeId: string | null = null;
  try {
    const coupon = await stripe.coupons.create({
      ...(body.discountType === "percentage"
        ? { percent_off: amount }
        : { amount_off: gbpToPence(amount), currency: "gbp" }),
      duration: "once",
      metadata: {
        expert_user_id: user.id,
        service_id: serviceId ?? "all",
        source: "sensei_discount",
      },
      name: normalizedCode
        ? `Sensei promo ${normalizedCode}`
        : "Sensei automatic discount",
    });
    couponId = coupon.id;

    if (normalizedCode) {
      const promotionPayload = {
        coupon: coupon.id,
        code: normalizedCode,
        active: isActive,
        max_redemptions: maxUses ?? undefined,
        expires_at: endDate
          ? Math.floor(new Date(endDate).getTime() / 1000)
          : undefined,
        metadata: {
          expert_user_id: user.id,
          service_id: serviceId ?? "all",
          source: "sensei_discount",
        },
      } as unknown as Stripe.PromotionCodeCreateParams;
      const promotion = await stripe.promotionCodes.create({
        ...promotionPayload,
      });
      promotionCodeId = promotion.id;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe error" },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("discounts")
    .insert({
      expert_user_id: user.id,
      service_id: serviceId,
      discount_type: body.discountType,
      amount,
      code: normalizedCode,
      stripe_coupon_id: couponId,
      stripe_promotion_code_id: promotionCodeId,
      start_date: startDate,
      end_date: endDate,
      max_uses: maxUses,
      current_uses: 0,
      is_active: isActive,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to save discount" },
      { status: 500 },
    );
  }

  return NextResponse.json({ discount: inserted });
}
