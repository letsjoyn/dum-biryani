// Validation for CMS-authored menu data. Kept in a pure module so it is
// unit-testable without a server, and so POST/PUT share one rule set.
// This exists because v1 validated only price: a portions value of the
// string "oops" was stored, and the menu card then crashed calling
// .find on a string. Validation must run BEFORE any DB mutation, or a
// rejected request leaves a half-created item behind (v1 did exactly that
// for an invalid outlet-price override).
const SPICES = ['Mild', 'Medium', 'Hot', 'Very Hot'];
const MENU_TAGS = ['All day', 'Lunch', 'Dinner'];
const isPosInt = (v) => Number.isInteger(v) && v > 0;

function validateList(list, kind) {
  if (list === undefined || list === null) return null;
  if (!Array.isArray(list)) return `${kind} must be a list.`;
  if (list.length > 20) return `${kind} can have at most 20 entries.`;
  const seen = new Set();
  for (const e of list) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return `Each ${kind.slice(0, -1)} needs a label and a price.`;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    if (!label || label.length > 60) return `Each ${kind.slice(0, -1)} needs a label (1–60 characters).`;
    const key = label.toLowerCase();
    if (seen.has(key)) return `Duplicate ${kind.slice(0, -1)} label: ${label}.`;
    seen.add(key);
    if (kind === 'portions' && !isPosInt(e.price)) return `Portion "${label}" needs a price above zero.`;
    if (kind === 'addons' && !(Number.isInteger(e.price) && e.price >= 0)) return `Add-on "${label}" needs a price of zero or more.`;
  }
  return null;
}

function validateOutletPrices(prices) {
  if (prices === undefined || prices === null) return null;
  if (typeof prices !== 'object' || Array.isArray(prices)) return 'Outlet prices must be an object keyed by outlet id.';
  for (const [oid, v] of Object.entries(prices)) {
    if (v === '' || v === null) continue;
    if (!isPosInt(v)) return `Outlet price for outlet ${oid} must be above zero or blank.`;
  }
  return null;
}

// b: request body. partial=true for PUT (only validate fields present).
function validateMenuItem(b, partial = false) {
  if (!b || typeof b !== 'object') return 'Invalid item data.';
  if (!partial) {
    if (!b.name || typeof b.name !== 'string' || !b.name.trim()) return 'Name is required.';
    if (!b.category || typeof b.category !== 'string' || !b.category.trim()) return 'Category is required.';
    if (!isPosInt(b.price)) return 'Price must be above zero.';
  } else {
    if (b.name !== undefined && (typeof b.name !== 'string' || !b.name.trim())) return 'Name cannot be empty.';
    if (b.category !== undefined && (typeof b.category !== 'string' || !b.category.trim())) return 'Category cannot be empty.';
    if (b.price !== undefined && !isPosInt(Number(b.price))) return 'Price must be above zero.';
  }
  if (b.spice !== undefined && !SPICES.includes(b.spice)) return 'Spice must be Mild, Medium, Hot or Very Hot.';
  if (b.menu_tag !== undefined && !MENU_TAGS.includes(b.menu_tag)) return 'Menu tag must be All day, Lunch or Dinner.';
  if (b.base_minutes !== undefined && !(Number.isInteger(Number(b.base_minutes)) && Number(b.base_minutes) >= 1 && Number(b.base_minutes) <= 240)) return 'Base prep minutes must be 1 to 240.';
  return validateList(b.portions, 'portions') || validateList(b.addons, 'addons') || validateOutletPrices(b.outletPrices);
}

module.exports = { SPICES, MENU_TAGS, isPosInt, validateList, validateOutletPrices, validateMenuItem };
