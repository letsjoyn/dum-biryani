// Pricing: prices stored in the DB INCLUDE 5% GST (as the brief requires).
// The server never trusts a client-sent total: it recomputes from DB prices,
// the coupon rule and the loyalty balance, then splits GST out for display:
//   gst = payable * 5 / 105,  base = payable - gst   (because payable is GST-inclusive)
const GST_RATE = 0.05;

function gstSplit(payable) {
  const gst = Math.round((payable * GST_RATE) / (1 + GST_RATE) * 100) / 100;
  return { base: Math.round((payable - gst) * 100) / 100, gst };
}

// coupon: { code, kind: 'percent'|'flat', value, minOrder } | null
function couponDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  if (subtotal < (coupon.minOrder || 0)) return 0;
  if (coupon.kind === 'percent') return Math.floor((subtotal * coupon.value) / 100);
  if (coupon.kind === 'flat') return Math.min(coupon.value, subtotal);
  return 0;
}

// Loyalty: 100 points = Rs 50 off. Discount is a multiple of 50, capped at
// the amount left after the coupon, and at the points the customer holds.
function loyaltyDiscount(afterCoupon, pointsBalance, usePoints) {
  if (!usePoints || !pointsBalance) return { discount: 0, pointsUsed: 0 };
  const blocks = Math.floor(pointsBalance / 100);
  const discount = Math.min(blocks * 50, afterCoupon);
  return { discount, pointsUsed: Math.floor(discount / 50) * 100 };
}

function pointsEarned(payable) {
  return Math.floor(payable / 20); // 1 point per Rs 20 spent
}

// lines: [{ unitPrice, qty }] already resolved from DB (portion + add-ons).
function computeOrder({ lines, coupon = null, pointsBalance = 0, usePoints = false }) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const couponOff = couponDiscount(subtotal, coupon);
  const afterCoupon = subtotal - couponOff;
  const loy = loyaltyDiscount(afterCoupon, pointsBalance, usePoints);
  const payable = Math.max(0, afterCoupon - loy.discount);
  const { base, gst } = gstSplit(payable);
  return {
    subtotal, couponOff, loyaltyOff: loy.discount, pointsUsed: loy.pointsUsed,
    payable, base, gst, pointsEarned: pointsEarned(payable),
  };
}

// Per-outlet price override: the override replaces the item's base (single)
// price, and portion prices keep their original delta from that base price.
// E.g. base 299 / family 900 (delta 601); override 319 -> family 920.
// A null override means "use the base price".
function effectivePortions(item, priceOverride) {
  let portions;
  try { portions = JSON.parse(item.portions || '[]'); } catch { portions = []; }
  if (!Array.isArray(portions)) portions = [];
  if (priceOverride === null || priceOverride === undefined) return portions;
  return portions.map((pt) => ({ ...pt, price: priceOverride + (pt.price - item.price) }));
}
function effectivePrice(item, priceOverride) {
  return priceOverride === null || priceOverride === undefined ? item.price : priceOverride;
}

module.exports = { GST_RATE, gstSplit, couponDiscount, loyaltyDiscount, pointsEarned, computeOrder, effectivePortions, effectivePrice };
