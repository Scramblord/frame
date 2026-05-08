export type DiscountType = "percentage" | "fixed";

export type DiscountRow = {
  id: string;
  expert_user_id: string;
  service_id: string | null;
  discount_type: DiscountType;
  amount: number | string;
  code: string | null;
  stripe_coupon_id: string;
  stripe_promotion_code_id: string | null;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
};

export function isDiscountActiveNow(
  discount: Pick<
    DiscountRow,
    "is_active" | "start_date" | "end_date" | "max_uses" | "current_uses"
  >,
  now = new Date(),
): boolean {
  if (!discount.is_active) return false;
  if (discount.max_uses != null && discount.current_uses >= discount.max_uses) {
    return false;
  }
  const nowMs = now.getTime();
  if (discount.start_date) {
    const startMs = new Date(discount.start_date).getTime();
    if (Number.isFinite(startMs) && startMs > nowMs) return false;
  }
  if (discount.end_date) {
    const endMs = new Date(discount.end_date).getTime();
    if (Number.isFinite(endMs) && endMs < nowMs) return false;
  }
  return true;
}

export function discountAmountForTotal(
  totalGbp: number,
  discount: Pick<DiscountRow, "discount_type" | "amount">,
): number {
  const amount = Number(discount.amount);
  if (!Number.isFinite(amount) || amount <= 0 || totalGbp <= 0) return 0;
  if (discount.discount_type === "percentage") {
    return Math.min(totalGbp, (totalGbp * amount) / 100);
  }
  return Math.min(totalGbp, amount);
}

export function applyDiscountToTotal(
  totalGbp: number,
  discount: Pick<DiscountRow, "discount_type" | "amount">,
): number {
  const raw = totalGbp - discountAmountForTotal(totalGbp, discount);
  return Math.max(0, Math.round(raw * 100) / 100);
}

export function bestAutomaticDiscountForService(
  discounts: DiscountRow[],
  serviceId: string,
  baseAmountForComparison: number,
): DiscountRow | null {
  let best: DiscountRow | null = null;
  let bestSavings = 0;
  for (const discount of discounts) {
    if (discount.code != null) continue;
    if (discount.service_id != null && discount.service_id !== serviceId) continue;
    if (!isDiscountActiveNow(discount)) continue;
    const savings = discountAmountForTotal(baseAmountForComparison, discount);
    if (savings > bestSavings) {
      best = discount;
      bestSavings = savings;
    }
  }
  return best;
}

export function discountBadgeLabel(
  discount: Pick<DiscountRow, "discount_type" | "amount">,
): string {
  const amount = Number(discount.amount);
  if (discount.discount_type === "percentage") {
    return `${amount}% off`;
  }
  const fixed = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `£${fixed} off`;
}
