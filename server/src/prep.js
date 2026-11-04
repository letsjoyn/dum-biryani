// Deterministic prep-time estimator (the honest "AI prep-time" for this demo).
// No LLM call, no invented text: a transparent formula over kitchen load.
// Inputs are plain data so every number shown in the UI can be explained.
//
// items: [{ baseMinutes, qty }] — baseMinutes is the item's kitchen prep time.
// activeOrders: number of orders currently New/Preparing in this outlet.
// outletMinimum: the outlet's promised floor (minutes), never undercut.
//
// Formula:
//   base      = slowest single item + 3 min for each extra distinct line
//             + 2 min for each extra unit of the same item
//   queueLoad = min(activeOrders * 4, 30)  — each queued order adds load, capped
//   total     = base + queueLoad
//   promised  = max(total, outletMinimum)
function estimatePrep({ items = [], activeOrders = 0, outletMinimum = 30 } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { base: outletMinimum, queueLoad: 0, total: outletMinimum, promised: outletMinimum };
  }
  const slowest = Math.max(...items.map((i) => Number(i.baseMinutes) || 0));
  const extraLines = Math.max(0, items.length - 1) * 3;
  // Quantity matters (v3, QA P2): extra units of the same item still take
  // kitchen time, at 2 min per extra unit. Items without a qty default to 1,
  // so every existing test expectation is unchanged.
  const totalUnits = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
  const extraUnits = Math.max(0, totalUnits - items.length) * 2;
  const base = slowest + extraLines + extraUnits;
  const queueLoad = Math.min(Math.max(0, Number(activeOrders) || 0) * 4, 30);
  const total = base + queueLoad;
  const promised = Math.max(total, Number(outletMinimum) || 0);
  return { base, queueLoad, total, promised };
}

// Manager override: an explicit override replaces the estimate for the
// promised time. It is stored on the order and written to the order history
// note so the override is auditable. Invalid overrides are ignored.
function applyOverride(estimate, overrideMinutes) {
  const o = Number(overrideMinutes);
  if (!Number.isFinite(o) || o <= 0 || o > 240) return estimate.promised;
  return Math.round(o);
}

function minutesLate(promisedAt, now = new Date()) {
  if (!promisedAt) return 0;
  const diff = (new Date(now) - new Date(promisedAt)) / 60000;
  return diff > 0 ? Math.floor(diff) : 0;
}

module.exports = { estimatePrep, applyOverride, minutesLate };
