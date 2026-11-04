const test = require('node:test');
const assert = require('node:assert');
const { isAvailableNow, windowLabel } = require('../src/timewindow');
const { effectivePortions, effectivePrice } = require('../src/pricing');
// Dates constructed in UTC; IST = UTC+5:30, so 06:00Z = 11:30 IST (lunch),
// 13:00Z = 18:30 IST (dinner), 10:00Z = 15:30 IST (lunch), 11:00Z = 16:30 IST (gap).
test('lunch window is 11:00-16:00 IST', () => {
  assert.equal(isAvailableNow('Lunch', new Date('2026-11-04T06:00:00Z')), true);
  assert.equal(isAvailableNow('Lunch', new Date('2026-11-04T11:00:00Z')), false);
});
test('dinner window starts 18:00 IST, all day always on', () => {
  assert.equal(isAvailableNow('Dinner', new Date('2026-11-04T13:00:00Z')), true);
  assert.equal(isAvailableNow('Dinner', new Date('2026-11-04T06:00:00Z')), false);
  assert.equal(isAvailableNow('All day', new Date('2026-11-04T03:00:00Z')), true);
});
test('window labels are explicit', () => {
  assert.match(windowLabel('Dinner'), /dinner/);
  assert.match(windowLabel('Lunch'), /lunch/);
});
test('per-outlet override keeps portion deltas', () => {
  const item = { price: 299, portions: JSON.stringify([{ label: 'Single', price: 299 }, { label: 'Family (serves 4)', price: 900 }]) };
  assert.deepEqual(effectivePortions(item, null).map((p) => p.price), [299, 900]);
  assert.deepEqual(effectivePortions(item, 319).map((p) => p.price), [319, 920]);
  assert.equal(effectivePrice(item, 319), 319);
  assert.equal(effectivePrice(item, null), 299);
});
