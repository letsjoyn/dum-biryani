// Pure validation rules mirrored from the order endpoint: quantities,
// outlet ids and portion/add-on lookups must be rejected, never trusted.
const test = require('node:test');
const assert = require('node:assert');

function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return 'Your cart is empty.';
  for (const c of cart) {
    if (!Number.isInteger(c.qty) || c.qty < 1 || c.qty > 20) return 'Quantity must be between 1 and 20.';
  }
  return null;
}
function validateParty({ guests, eventAt, now = Date.now() }) {
  if (!Number.isInteger(guests) || guests < 10 || guests > 500) return 'Party orders are for 10 to 500 guests.';
  if (new Date(eventAt) - now < 48 * 3600 * 1000) return 'Party orders need at least 48 hours notice.';
  return null;
}

test('invalid quantities rejected', () => {
  assert.ok(validateCart([]));
  assert.ok(validateCart([{ qty: 0 }]));
  assert.ok(validateCart([{ qty: 21 }]));
  assert.ok(validateCart([{ qty: 1.5 }]));
  assert.equal(validateCart([{ qty: 2 }]), null);
});

test('party 48h notice enforced', () => {
  assert.ok(validateParty({ guests: 50, eventAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }));
  assert.equal(validateParty({ guests: 50, eventAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString() }), null);
  assert.ok(validateParty({ guests: 5, eventAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString() }));
});
