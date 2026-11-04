// CMS validation (v2): portions/add-ons and outlet overrides are validated
// BEFORE any DB mutation, so a rejected request cannot leave a half-created
// item behind, and a malformed portions value cannot crash the menu card.
const test = require('node:test');
const assert = require('node:assert');
const { validateMenuItem, validateOutletPrices, validateList } = require('../src/validate');

test('portions must be a list with labels and positive prices', () => {
  assert.ok(validateList('oops', 'portions'));
  assert.ok(validateList([{ label: '', price: 100 }], 'portions'));
  assert.ok(validateList([{ label: 'Single', price: 0 }], 'portions'));
  assert.ok(validateList([{ label: 'Single', price: 299.5 }], 'portions'));
  assert.ok(validateList([{ label: 'Single', price: 299 }, { label: 'single', price: 900 }], 'portions'));
  assert.equal(validateList([{ label: 'Single', price: 299 }, { label: 'Family', price: 900 }], 'portions'), null);
  assert.equal(validateList([], 'portions'), null);
  assert.equal(validateList(undefined, 'portions'), null);
});

test('add-ons allow a zero price but not a negative or duplicate label', () => {
  assert.ok(validateList([{ label: 'Extra raita', price: -1 }], 'addons'));
  assert.ok(validateList([{ label: 'Extra raita', price: 49 }, { label: 'extra raita', price: 49 }], 'addons'));
  assert.equal(validateList([{ label: 'Extra raita', price: 0 }], 'addons'), null);
});

test('outlet override prices must be positive or blank', () => {
  assert.ok(validateOutletPrices({ 1: -5 }));
  assert.ok(validateOutletPrices({ 1: 299.5 }));
  assert.equal(validateOutletPrices({ 1: 319, 2: '', 3: null }), null);
});

test('menu item validation covers tag, spice and base minutes', () => {
  assert.ok(validateMenuItem({ name: 'X', category: 'Biryani', price: 100, menu_tag: 'Brunch' }));
  assert.ok(validateMenuItem({ name: 'X', category: 'Biryani', price: 100, spice: 'Extreme' }));
  assert.ok(validateMenuItem({ name: 'X', category: 'Biryani', price: 100, base_minutes: 0 }));
  assert.equal(validateMenuItem({ name: 'X', category: 'Biryani', price: 100, portions: [{ label: 'Single', price: 100 }] }), null);
  // PUT (partial): only fields present are checked.
  assert.equal(validateMenuItem({ portions: [{ label: 'Family', price: 900 }] }, true), null);
  assert.ok(validateMenuItem({ portions: 'oops' }, true));
});
