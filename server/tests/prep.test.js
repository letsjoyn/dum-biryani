const test = require('node:test');
const assert = require('node:assert');
const { estimatePrep, applyOverride, minutesLate } = require('../src/prep');

test('base case: single item, no queue', () => {
  const e = estimatePrep({ items: [{ baseMinutes: 25 }], activeOrders: 0, outletMinimum: 30 });
  assert.equal(e.base, 25);
  assert.equal(e.queueLoad, 0);
  assert.equal(e.promised, 30); // floor is the outlet minimum
});

test('queue load increases the estimate, capped at 30', () => {
  const light = estimatePrep({ items: [{ baseMinutes: 25 }], activeOrders: 2, outletMinimum: 30 });
  assert.equal(light.queueLoad, 8);
  const heavy = estimatePrep({ items: [{ baseMinutes: 25 }], activeOrders: 20, outletMinimum: 30 });
  assert.equal(heavy.queueLoad, 30);
  assert.ok(heavy.promised > light.promised);
});

test('promised never below outlet minimum', () => {
  const e = estimatePrep({ items: [{ baseMinutes: 10 }], activeOrders: 0, outletMinimum: 35 });
  assert.equal(e.promised, 35);
});

test('extra lines add prep time', () => {
  const one = estimatePrep({ items: [{ baseMinutes: 20 }], activeOrders: 0, outletMinimum: 10 });
  const three = estimatePrep({ items: [{ baseMinutes: 20 }, { baseMinutes: 15 }, { baseMinutes: 10 }], activeOrders: 0, outletMinimum: 10 });
  assert.equal(three.base, 26);
  assert.ok(three.promised > one.promised);
});

test('manager override is respected, invalid overrides ignored', () => {
  const e = estimatePrep({ items: [{ baseMinutes: 25 }], activeOrders: 0, outletMinimum: 30 });
  assert.equal(applyOverride(e, 50), 50);
  assert.equal(applyOverride(e, 0), e.promised);
  assert.equal(applyOverride(e, 999), e.promised);
});

test('minutesLate is 0 before promise, positive after', () => {
  const future = new Date(Date.now() + 600000).toISOString();
  const past = new Date(Date.now() - 12 * 60000).toISOString();
  assert.equal(minutesLate(future), 0);
  assert.ok(minutesLate(past) >= 12);
});

test('extra units of the same item add prep time', () => {
  const one = estimatePrep({ items: [{ baseMinutes: 20, qty: 1 }], activeOrders: 0, outletMinimum: 10 });
  const three = estimatePrep({ items: [{ baseMinutes: 20, qty: 3 }], activeOrders: 0, outletMinimum: 10 });
  assert.equal(one.base, 20);
  assert.equal(three.base, 24);
});
