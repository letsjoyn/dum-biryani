const test = require('node:test');
const assert = require('node:assert');
const { sortKdsOrders } = require('../src/kds');

const mk = (id, over) => ({ id, order_no: `WEB-${id}`, promised_at: '2026-11-04T20:00:00.000Z', isLate: false, managerAlert: false, ...over });
test('KDS sorts 10+ min late first, then late, then by promised time', () => {
  const orders = [
    mk(1, { promised_at: '2026-11-04T20:30:00.000Z' }),
    mk(2, { promised_at: '2026-11-04T20:10:00.000Z', isLate: true }),
    mk(3, { promised_at: '2026-11-04T20:05:00.000Z', isLate: true, managerAlert: true }),
    mk(4, { promised_at: '2026-11-04T20:20:00.000Z' }),
  ];
  const sorted = sortKdsOrders(orders).map((o) => o.id);
  assert.deepEqual(sorted, [3, 2, 4, 1]);
});
test('KDS sort does not mutate the input', () => {
  const orders = [mk(2, { isLate: true }), mk(1)];
  sortKdsOrders(orders);
  assert.equal(orders[0].id, 2);
});
