// KDS ordering: late orders first (10+ min late before merely late), then by
// promised time, then by placement. Pure function, unit-tested.
function sortKdsOrders(orders) {
  const rank = (o) => {
    if (o.managerAlert) return 0;
    if (o.isLate) return 1;
    return 2;
  };
  return [...orders].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.promised_at !== b.promised_at) return a.promised_at < b.promised_at ? -1 : 1;
    return a.id - b.id;
  });
}
module.exports = { sortKdsOrders };
