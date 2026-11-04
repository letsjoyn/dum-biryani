// Time-based menus. Windows are in IST (the chain's city, Hyderabad).
// Lunch 11:00-15:59, Dinner 18:00-23:59, All day always available.
// The gap 16:00-17:59 is real: lunch items are off, dinner items not yet on.
const WINDOWS = { Lunch: [11, 16], Dinner: [18, 24], 'All day': [0, 24] };
function istHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(date));
}
function isAvailableNow(menuTag, date = new Date()) {
  const w = WINDOWS[menuTag] || WINDOWS['All day'];
  const h = istHour(date);
  return h >= w[0] && h < w[1];
}
function windowLabel(menuTag) {
  if (menuTag === 'Lunch') return 'Available at lunch, 11:00-16:00 IST';
  if (menuTag === 'Dinner') return 'Available at dinner, 18:00-24:00 IST';
  return 'Available all day';
}
module.exports = { WINDOWS, istHour, isAvailableNow, windowLabel };
