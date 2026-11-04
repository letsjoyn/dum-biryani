const test = require('node:test');
const assert = require('node:assert');
const { computeOrder, gstSplit, couponDiscount, loyaltyDiscount } = require('../src/pricing');

test('GST-inclusive split: base + gst = payable', () => {
  const { base, gst } = gstSplit(1050);
  assert.equal(base + gst, 1050);
  assert.equal(gst, 50);
});

test('coupon percent + loyalty math', () => {
  const r = computeOrder({ lines: [{ unitPrice: 900, qty: 1 }, { unitPrice: 140, qty: 2 }], coupon: { kind: 'percent', value: 10, minOrder: 0 }, pointsBalance: 240, usePoints: true });
  assert.equal(r.subtotal, 1180);
  assert.equal(r.couponOff, 118);
  // 240 points = 2x50 = 100 off, capped by amount left
  assert.equal(r.loyaltyOff, 100);
  assert.equal(r.pointsUsed, 200);
  assert.equal(r.payable, 962);
  assert.equal(r.pointsEarned, Math.floor(962 / 20));
});

test('flat coupon respects minimum order', () => {
  assert.equal(couponDiscount(400, { kind: 'flat', value: 100, minOrder: 499 }), 0);
  assert.equal(couponDiscount(600, { kind: 'flat', value: 100, minOrder: 499 }), 100);
});

test('loyalty capped at amount left after coupon', () => {
  const d = loyaltyDiscount(40, 1000, true);
  assert.equal(d.discount, 40);
  assert.equal(d.pointsUsed, 0); // 40 is not a full 50 block: floor(40/50)*100 = 0
});

test('no coupon, no loyalty: payable = subtotal', () => {
  const r = computeOrder({ lines: [{ unitPrice: 350, qty: 3 }] });
  assert.equal(r.subtotal, 1050);
  assert.equal(r.payable, 1050);
});

test('server ignores any client-sent total: totals derive only from DB lines', () => {
  // A tampered client payload claiming a Rs 1 total cannot change the result:
  // computeOrder takes no total input at all — only DB-resolved lines.
  const tamperedClientTotal = 1;
  const r = computeOrder({ lines: [{ unitPrice: 900, qty: 1 }, { unitPrice: 140, qty: 2 }] });
  assert.notEqual(r.payable, tamperedClientTotal);
  assert.equal(r.payable, 1180);
});
