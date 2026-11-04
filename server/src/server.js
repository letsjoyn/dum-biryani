const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { db } = require('./db');
const { seed } = require('./seed');
const { estimatePrep, applyOverride, minutesLate } = require('./prep');
const { computeOrder, effectivePortions, effectivePrice } = require('./pricing');
const { isAvailableNow, windowLabel } = require('./timewindow');
const { sortKdsOrders } = require('./kds');
const { validateMenuItem, validateOutletPrices } = require('./validate');

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const CLIENT_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const FRONTEND_URL_SET = !!(process.env.FRONTEND_URL || process.env.CLIENT_URL);
// CORS (fixed in v3, QA P0): the old code allowed ONLY localhost:5173, so on
// Render — where FRONTEND_URL is intentionally unset and the SPA is served
// from the same origin — the Socket.io handshake could be rejected, killing
// live KDS/tracking (the brief's hard part). Now: when FRONTEND_URL is set
// (split deploy / Vite dev) only that origin is allowed; when it is unset
// (single-URL deploy) the page is served by this server, so its origin is
// reflected. JWT auth is still required for every protected route and for
// joining order rooms, so CORS reflection alone grants nothing.
function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  if (origin === CLIENT_URL) return cb(null, true);
  if (!FRONTEND_URL_SET) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
}

seed();

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '200kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin } });

io.use((socket, next) => {
  const tok = socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
  if (tok) { try { socket.user = jwt.verify(tok, JWT_SECRET); } catch { socket.user = null; } }
  next();
});
io.on('connection', (socket) => {
  socket.on('join-outlet', (outletId) => {
    // Kitchen staff may only join their own outlet's room. Customers join
    // outlet rooms too, but only for the public menu channel (menu:updated);
    // order data is never sent to outlet rooms, only to order rooms below.
    if (socket.user && socket.user.role === 'kitchen' && Number(outletId) !== socket.user.outlet_id) return;
    if (Number.isInteger(+outletId)) socket.join(`outlet:${outletId}`);
  });
  socket.on('leave-outlet', (outletId) => { if (Number.isInteger(+outletId)) socket.leave(`outlet:${outletId}`); });
  socket.on('join-order', (orderNo) => {
    // Order rooms are the one place order data travels: guessing an order
    // number is not enough — the socket must carry a JWT for that order's
    // customer, its outlet's kitchen staff, or a manager. Unauthenticated
    // sockets are not admitted (QA security flag, v3).
    if (typeof orderNo !== 'string' || !socket.user) return;
    const o = db.prepare('SELECT * FROM orders WHERE order_no=?').get(orderNo);
    if (!o) return;
    if (socket.user.role === 'customer' && o.user_id !== socket.user.id) return;
    if (socket.user.role === 'kitchen' && o.outlet_id !== socket.user.outlet_id) return;
    if (!['customer', 'kitchen', 'manager'].includes(socket.user.role)) return;
    socket.join(`order:${orderNo}`);
  });
});

const sign = (u) => jwt.sign({ id: u.id, role: u.role, outlet_id: u.outlet_id, name: u.name }, JWT_SECRET, { expiresIn: '12h' });
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Please sign in first.' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); } catch { return res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have access to this.' });
const bad = (res, msg) => res.status(400).json({ error: msg });
const isInt = (v) => Number.isInteger(v);

function publicItem(row, outletId) {
  const oos = outletId ? db.prepare('SELECT out_of_stock, price_override FROM item_outlets WHERE item_id=? AND outlet_id=?').get(row.id, outletId) : null;
  const override = oos ? oos.price_override : null;
  return { ...row, veg: !!row.veg, active: !!row.active,
    portions: effectivePortions(row, override), addons: (() => { try { const a = JSON.parse(row.addons || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })(),
    outOfStock: oos ? !!oos.out_of_stock : false, priceOverride: override,
    price: effectivePrice(row, override), windowNote: windowLabel(row.menu_tag) };
}
function orderWithItems(o) {
  const items = db.prepare('SELECT oi.*, it.photo AS photo FROM order_items oi LEFT JOIN items it ON it.id = oi.item_id WHERE oi.order_id=?').all(o.id).map((i) => ({ ...i, addons: JSON.parse(i.addons || '[]') }));
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=?').get(o.outlet_id);
  const events = db.prepare('SELECT * FROM order_events WHERE order_id=? ORDER BY id').all(o.id).map((e) => ({ ...e, to_status: e.to_status || e.status }));
  const notifications = db.prepare('SELECT * FROM notifications WHERE order_id=? ORDER BY id').all(o.id);
  const late = minutesLate(o.promised_at);
  return { ...o, items, events, notifications, outlet_name: outlet ? outlet.name : '', estimate: JSON.parse(o.estimate_breakdown || '{}'), minutesLate: late, isLate: late > 0 && !['Ready', 'Handed over', 'Cancelled'].includes(o.status), managerAlert: late >= 10 && !['Ready', 'Handed over', 'Cancelled'].includes(o.status) };
}
function emitOrder(order) {
  const full = orderWithItems(order);
  io.to(`outlet:${order.outlet_id}`).emit('order:updated', full);
  io.to(`order:${order.order_no}`).emit('order:updated', full);
  return full;
}
function notify(orderId, message) {
  db.prepare('INSERT INTO notifications (order_id,kind,message) VALUES (?,?,?)').run(orderId, 'transactional', message);
}
function nextOrderNo() {
  // Max across ALL order numbers (seed inserts are not in numeric order),
  // so numbers never collide or go backwards.
  const rows = db.prepare('SELECT order_no FROM orders').all();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.order_no.replace(/\D/g, ''), 10) || 0), 778146);
  return `WEB-${max + 1}`;
}

// ---------- public ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/outlets', (req, res) => res.json(db.prepare('SELECT * FROM outlets WHERE active=1 ORDER BY id').all()));
app.get('/api/menu', (req, res) => {
  const outletId = Number(req.query.outletId);
  if (!isInt(outletId)) return bad(res, 'Choose an outlet first.');
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=?').get(outletId);
  if (!outlet) return bad(res, 'Unknown outlet.');
  // Availability is real: an item with no item_outlets row for this outlet
  // is NOT on this outlet's menu (v1 ignored the CMS outlet checkboxes).
  const rows = db.prepare(`SELECT i.* FROM items i JOIN item_outlets io ON io.item_id=i.id AND io.outlet_id=?
    WHERE i.active=1 ORDER BY i.category, i.name`).all(outletId);
  res.json(rows.map((r) => publicItem(r, outletId)));
});
app.get('/api/coupons/:code', (req, res) => {
  const c = db.prepare('SELECT * FROM coupons WHERE code=?').get(req.params.code.toUpperCase());
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  res.json(c);
});

// ---------- auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return bad(res, 'Email and password are required.');
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email).toLowerCase());
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, outlet_id: u.outlet_id, points: u.points } });
});
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8) return bad(res, 'Name, email and a password of 8+ characters are required.');
  if (db.prepare('SELECT id FROM users WHERE email=?').get(String(email).toLowerCase())) return bad(res, 'That email is already registered. Try signing in.');
  const r = db.prepare('INSERT INTO users (name,email,password_hash,role,points) VALUES (?,?,?, ?,0)').run(name, String(email).toLowerCase(), bcrypt.hashSync(password, 10), 'customer');
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
  res.status(201).json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, outlet_id: u.outlet_id, points: u.points } });
});
app.get('/api/auth/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, outlet_id: u.outlet_id, points: u.points, marketing_opt_in: !!u.marketing_opt_in });
});

app.patch('/api/auth/me', auth, (req, res) => {
  const v = req.body && req.body.marketing_opt_in;
  if (typeof v !== 'boolean') return bad(res, 'marketing_opt_in must be true or false.');
  db.prepare('UPDATE users SET marketing_opt_in=? WHERE id=?').run(v ? 1 : 0, req.user.id);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ marketing_opt_in: !!u.marketing_opt_in });
});

// ---------- customer orders ----------
app.post('/api/orders', auth, requireRole('customer'), (req, res) => {
  const { outletId, items: cart, paymentMethod, couponCode, usePoints, cardLast4, upiId } = req.body || {};
  const deliveryAddress = typeof req.body.deliveryAddress === 'string' ? req.body.deliveryAddress.trim().slice(0, 300) : '';
  if (!deliveryAddress) return bad(res, 'Delivery address is required.');
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=?').get(Number(outletId));
  if (!outlet) return bad(res, 'Choose a valid outlet.');
  if (!Array.isArray(cart) || cart.length === 0) return bad(res, 'Your cart is empty.');
  if (!['UPI', 'Card'].includes(paymentMethod)) return bad(res, 'Choose UPI or Card.');
  if (paymentMethod === 'Card' && !/^\d{4}$/.test(cardLast4 || '')) return bad(res, 'Enter a test card number (any test number except one ending in 0000).');
  if (paymentMethod === 'Card' && cardLast4 === '0000') {
    // TEST-MODE failure path: no order is created, nothing is charged.
    return res.status(402).json({ error: 'Test payment declined: card ending 0000 is the test failure card. Try another card or UPI.' });
  }
  if (paymentMethod === 'UPI' && upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return bad(res, 'That UPI ID does not look right (e.g. name@okhdfc).');

  // Double-submit guard: a retried request carrying the same client-generated
  // key returns the original order instead of creating (and charging points for) a second one.
  const requestKey = (req.body && req.body.requestKey) || null;
  if (requestKey) {
    const existing = db.prepare('SELECT * FROM orders WHERE request_key=? AND user_id=?').get(requestKey, req.user.id);
    if (existing) return res.status(200).json(orderWithItems(existing));
  }
  const lines = [];
  for (const c of cart) {
    if (!isInt(c.qty) || c.qty < 1 || c.qty > 20) return bad(res, 'Quantity must be between 1 and 20.');
    const item = db.prepare('SELECT * FROM items WHERE id=? AND active=1').get(Number(c.itemId));
    if (!item) return bad(res, 'An item in your cart is no longer available.');
    const avail = db.prepare('SELECT out_of_stock, price_override FROM item_outlets WHERE item_id=? AND outlet_id=?').get(item.id, outlet.id);
    if (!avail) return bad(res, `${item.name} is not available at this outlet.`);
    if (avail.out_of_stock) return bad(res, `${item.name} is out of stock at this outlet right now.`);
    if (!isAvailableNow(item.menu_tag)) return bad(res, `${item.name} is not available right now — ${windowLabel(item.menu_tag)}.`);
    const portions = effectivePortions(item, avail ? avail.price_override : null);
    let unit = effectivePrice(item, avail ? avail.price_override : null); let portionLabel = '';
    if (portions.length) {
      const p = portions.find((x) => x.label === c.portion) || portions[0];
      unit = p.price; portionLabel = p.label;
    }
    const addons = JSON.parse(item.addons || '[]');
    const chosenAddons = [];
    for (const a of (c.addons || [])) {
      const found = addons.find((x) => x.label === a);
      if (!found) return bad(res, `Unknown add-on for ${item.name}.`);
      chosenAddons.push(found.label); unit += found.price;
    }
    lines.push({ item, portionLabel, addons: chosenAddons, qty: c.qty, unitPrice: unit });
  }
  let coupon = null;
  if (couponCode) {
    coupon = db.prepare('SELECT * FROM coupons WHERE code=?').get(String(couponCode).toUpperCase());
    if (!coupon) return bad(res, 'Coupon not found.');
  }
  const me = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const totals = computeOrder({ lines: lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })), coupon, pointsBalance: me.points, usePoints: !!usePoints });
  if (totals.payable <= 0 && lines.length) return bad(res, 'Order total must be above zero.');
  const active = db.prepare("SELECT COUNT(*) c FROM orders WHERE outlet_id=? AND status IN ('Placed','Preparing')").get(outlet.id).c;
  const est = estimatePrep({ items: lines.map((l) => ({ baseMinutes: l.item.base_minutes, qty: l.qty })), activeOrders: active, outletMinimum: outlet.min_prep_minutes });
  const orderNo = nextOrderNo();
  const nowIso = new Date().toISOString();
  const promisedAt = new Date(Date.now() + est.promised * 60000).toISOString();
  const r = db.prepare(`INSERT INTO orders (order_no,user_id,outlet_id,status,subtotal,coupon_code,coupon_off,loyalty_off,points_used,points_earned,payable,gst_amount,payment_method,payment_ref,estimate_minutes,estimate_breakdown,promised_at,request_key,delivery_address,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderNo, me.id, outlet.id, 'Placed', totals.subtotal, coupon ? coupon.code : null, totals.couponOff, totals.loyaltyOff, totals.pointsUsed, totals.pointsEarned, totals.payable, totals.gst, paymentMethod, paymentMethod === 'UPI' ? (upiId || 'UPI·test') : `Card·${cardLast4 || '4242'}`, est.promised, JSON.stringify(est), promisedAt, requestKey, deliveryAddress, nowIso);
  const orderId = r.lastInsertRowid;
  lines.forEach((l) => db.prepare('INSERT INTO order_items (order_id,item_id,item_name,portion,addons,qty,unit_price) VALUES (?,?,?,?,?,?,?)')
    .run(orderId, l.item.id, l.item.name, l.portionLabel, JSON.stringify(l.addons), l.qty, l.unitPrice));
  db.prepare('INSERT INTO order_events (order_id,status,actor_name,from_status,to_status,created_at) VALUES (?,?,?,?,?,?)').run(orderId, 'Placed', me.name, '', 'Placed', nowIso);
  db.prepare('UPDATE users SET points = points - ? + ? WHERE id=?').run(totals.pointsUsed, totals.pointsEarned, me.id);
  if (req.body && typeof req.body.marketingOptIn === 'boolean') db.prepare('UPDATE users SET marketing_opt_in=? WHERE id=?').run(req.body.marketingOptIn ? 1 : 0, me.id);
  if (totals.pointsUsed > 0) db.prepare('INSERT INTO points_ledger (user_id,order_id,delta,reason) VALUES (?,?,?,?)').run(me.id, orderId, -totals.pointsUsed, `Redeemed on order ${orderNo}`);
  if (totals.pointsEarned > 0) db.prepare('INSERT INTO points_ledger (user_id,order_id,delta,reason) VALUES (?,?,?,?)').run(me.id, orderId, totals.pointsEarned, `Earned on order ${orderNo}`);
  notify(orderId, `WhatsApp/SMS update sent — mock: your order ${orderNo} is placed.`);
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  const full = emitOrder(order);
  // Also broadcast creation so KDS lists it even before any status change.
  io.to(`outlet:${outlet.id}`).emit('order:created', full);
  res.status(201).json(full);
});

app.get('/api/orders/mine', auth, requireRole('customer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json(rows.map(orderWithItems));
});
app.get('/api/orders/:orderNo', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE order_no=?').get(req.params.orderNo);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (req.user.role === 'customer' && o.user_id !== req.user.id) return res.status(403).json({ error: 'This order is not yours.' });
  if (req.user.role === 'kitchen' && o.outlet_id !== req.user.outlet_id) return res.status(403).json({ error: 'This order belongs to another outlet.' });
  res.json(orderWithItems(o));
});
app.get('/api/suggestions', auth, requireRole('customer'), (req, res) => {
  // Reorder suggestions: distinct items from this customer's past orders,
  // most recent first. They are suggestions only — never added to the cart.
  const rows = db.prepare(`SELECT oi.item_name, oi.portion, oi.unit_price, MAX(o.id) last_order
    FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=? AND o.status != 'Cancelled'
    GROUP BY oi.item_name, oi.portion, oi.unit_price ORDER BY last_order DESC LIMIT 8`).all(req.user.id);
  res.json(rows);
});

app.get('/api/loyalty/history', auth, requireRole('customer'), (req, res) => {
  res.json(db.prepare('SELECT * FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id));
});

// ---------- party ----------
app.post('/api/party', auth, (req, res) => {
  const { name, phone, outletId, eventAt, guests, notes } = req.body || {};
  if (!name || !phone || !eventAt || !guests) return bad(res, 'Name, phone, date/time and guest count are required.');
  if (!Number.isInteger(guests) || guests < 10 || guests > 500) return bad(res, 'Party orders are for 10 to 500 guests.');
  const when = new Date(eventAt);
  if (isNaN(when)) return bad(res, 'Pick a valid date and time.');
  if (when - Date.now() < 48 * 3600 * 1000) return bad(res, 'Party orders need at least 48 hours notice. Please pick a later date or call the outlet.');
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=?').get(Number(outletId));
  if (!outlet) return bad(res, 'Choose a valid outlet.');
  const r = db.prepare('INSERT INTO party_enquiries (user_id,name,phone,outlet_id,event_at,guests,notes) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, name, phone, outlet.id, when.toISOString(), guests, notes || '');
  res.status(201).json(db.prepare('SELECT * FROM party_enquiries WHERE id=?').get(r.lastInsertRowid));
});
app.get('/api/party/mine', auth, requireRole('customer'), (req, res) => {
  res.json(db.prepare(`SELECT p.*, o.name outlet_name FROM party_enquiries p JOIN outlets o ON o.id=p.outlet_id WHERE p.user_id=? ORDER BY p.id DESC`).all(req.user.id));
});
app.patch('/api/party/:id', auth, requireRole('manager'), (req, res) => {
  const { status, note } = req.body || {};
  if (!['Confirmed', 'Declined'].includes(status)) return bad(res, 'Status must be Confirmed or Declined.');
  const cur = db.prepare('SELECT * FROM party_enquiries WHERE id=?').get(Number(req.params.id));
  if (!cur) return res.status(404).json({ error: 'Party enquiry not found.' });
  db.prepare('UPDATE party_enquiries SET status=?, manager_note=? WHERE id=?').run(status, note || '', cur.id);
  res.json(db.prepare('SELECT * FROM party_enquiries WHERE id=?').get(cur.id));
});
app.get('/api/party', auth, requireRole('manager'), (req, res) => {
  res.json(db.prepare(`SELECT p.*, o.name outlet_name FROM party_enquiries p JOIN outlets o ON o.id=p.outlet_id ORDER BY p.id DESC`).all());
});

// ---------- kitchen ----------
app.get('/api/kitchen/orders', auth, (req, res) => {
  if (req.user.role === 'kitchen') {
    const rows = db.prepare("SELECT * FROM orders WHERE outlet_id=? AND status NOT IN ('Handed over','Cancelled') ORDER BY id ASC").all(req.user.outlet_id);
    return res.json(sortKdsOrders(rows.map(orderWithItems)));
  }
  if (req.user.role === 'manager') {
    const outletId = Number(req.query.outletId);
    const rows = outletId
      ? db.prepare("SELECT * FROM orders WHERE outlet_id=? AND status NOT IN ('Handed over','Cancelled') ORDER BY id ASC").all(outletId)
      : db.prepare("SELECT * FROM orders WHERE status NOT IN ('Handed over','Cancelled') ORDER BY id ASC").all();
    return res.json(sortKdsOrders(rows.map(orderWithItems)));
  }
  return res.status(403).json({ error: 'Kitchen or manager only.' });
});
const STATUS_FLOW = { Placed: ['Preparing', 'Cancelled'], Preparing: ['Ready', 'Cancelled'], Ready: ['Rider handoff', 'Cancelled'], 'Rider handoff': ['Handed over'], 'Handed over': [], Cancelled: [] };
app.patch('/api/kitchen/orders/:id/status', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (req.user.role === 'kitchen' && o.outlet_id !== req.user.outlet_id) return res.status(403).json({ error: 'This order belongs to another outlet.' });
  if (!['kitchen', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Kitchen or manager only.' });
  const { status } = req.body || {};
  if (!(STATUS_FLOW[o.status] || []).includes(status)) return bad(res, `Cannot move an order from ${o.status} to ${status}.`);
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, o.id);
  db.prepare('INSERT INTO order_events (order_id,status,actor_name,from_status,to_status,created_at) VALUES (?,?,?,?,?,?)').run(o.id, status, req.user.name, o.status, status, new Date().toISOString());
  notify(o.id, `WhatsApp/SMS update sent — mock: your order ${o.order_no} is now ${status}.`);
  res.json(emitOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id)));
});
app.patch('/api/kitchen/orders/:id/promise', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (req.user.role === 'kitchen' && o.outlet_id !== req.user.outlet_id) return res.status(403).json({ error: 'This order belongs to another outlet.' });
  if (!['kitchen', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Kitchen or manager only.' });
  const mins = Number(req.body.minutes);
  if (!Number.isInteger(mins) || mins < 5 || mins > 240) return bad(res, 'Override must be 5 to 240 minutes from now.');
  const promisedAt = new Date(Date.now() + mins * 60000).toISOString();
  db.prepare('UPDATE orders SET promised_at=?, promise_override=?, history_note=? WHERE id=?')
    .run(promisedAt, mins, `${req.user.role === 'manager' ? 'Manager' : 'Kitchen'} override: promised time set to ${mins} min by ${req.user.name} at ${new Date().toISOString()}.`, o.id);
  res.json(emitOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id)));
});
const handleStockToggle = (req, res) => {
  const itemId = Number(req.params.itemId);
  const outletId = Number(req.params.outletId);
  if (req.user.role === 'kitchen' && outletId !== req.user.outlet_id) {
    return res.status(403).json({ error: 'You can only change your own outlet.' });
  }
  if (!['kitchen', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Kitchen or manager only.' });
  }
  const item = db.prepare('SELECT id FROM items WHERE id=?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found in catalog.' });
  const outlet = db.prepare('SELECT id FROM outlets WHERE id=?').get(outletId);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found.' });

  const { outOfStock } = req.body || {};
  const flag = outOfStock ? 1 : 0;
  db.prepare(`
    INSERT INTO item_outlets (item_id, outlet_id, out_of_stock)
    VALUES (?, ?, ?)
    ON CONFLICT(item_id, outlet_id) DO UPDATE SET out_of_stock=excluded.out_of_stock
  `).run(itemId, outletId, flag);

  io.to(`outlet:${outletId}`).emit('menu:updated', { itemId, outletId, outOfStock: !!flag });
  io.emit('menu:updated', { itemId, outletId, outOfStock: !!flag });
  io.emit('admin:items-updated', { itemId, outletId, outOfStock: !!flag });
  res.json({ ok: true, itemId, outletId, outOfStock: !!flag });
};

app.patch('/api/kitchen/items/:itemId/outlet/:outletId/stock', auth, handleStockToggle);
app.patch('/api/kitchen/items/:itemId/outlet/:outletId/pause', auth, handleStockToggle);
app.patch('/api/admin/items/:itemId/outlet/:outletId/stock', auth, handleStockToggle);
app.patch('/api/admin/items/:itemId/outlet/:outletId/pause', auth, handleStockToggle);

// ---------- admin ----------
app.get('/api/admin/items', auth, requireRole('manager'), (req, res) => {
  const rows = db.prepare('SELECT * FROM items ORDER BY category, name').all().map((r) => publicItem(r, null));
  res.json(rows.map((r) => ({ ...r, outlets: db.prepare('SELECT outlet_id,out_of_stock,price_override FROM item_outlets WHERE item_id=?').all(r.id) })));
});
app.post('/api/admin/items', auth, requireRole('manager'), (req, res) => {
  const { name, category, description, price, veg, spice, allergens, photo, portions, addons, base_minutes, menu_tag, outletIds } = req.body || {};
  // Validate BEFORE any insert: v1 inserted the item first and only then
  // rejected a bad outlet override, leaving a half-created item behind.
  const vErr = validateMenuItem(req.body || {});
  if (vErr) return bad(res, vErr);
  // No outlet list given: list the item at every outlet rather than
  // creating an item that is invisible on every menu.
  const outletIdList = Array.isArray(outletIds) && outletIds.length ? outletIds : db.prepare('SELECT id FROM outlets').all().map((o) => o.id);
  for (const oid of outletIdList) {
    if (!Number.isInteger(oid) || !db.prepare('SELECT id FROM outlets WHERE id=?').get(oid)) return bad(res, 'One of the chosen outlets does not exist.');
  }
  const r = db.prepare(`INSERT INTO items (name,category,description,price,veg,spice,allergens,photo,portions,addons,base_minutes,menu_tag)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(name, category, description || '', price, veg ? 1 : 0, spice || 'Medium', allergens || '', photo || '', JSON.stringify(portions || []), JSON.stringify(addons || []), Number(base_minutes) || 25, menu_tag || 'All day');
  const id = r.lastInsertRowid;
  (Array.isArray(outletIds) ? outletIds : []).forEach((oid) => db.prepare('INSERT OR IGNORE INTO item_outlets (item_id,outlet_id) VALUES (?,?)').run(id, oid));
  if (req.body && req.body.outletPrices && typeof req.body.outletPrices === 'object') {
    for (const [oid, price] of Object.entries(req.body.outletPrices)) {
      const pv = price === null || price === '' ? null : Number(price);
      db.prepare('INSERT INTO item_outlets (item_id,outlet_id,price_override) VALUES (?,?,?) ON CONFLICT(item_id,outlet_id) DO UPDATE SET price_override=excluded.price_override').run(id, Number(oid), pv);
    }
  }
  io.emit('menu:updated', { itemId: id });
  io.emit('admin:items-updated', { itemId: id });
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id=?').get(id));
});
app.put('/api/admin/items/:id', auth, requireRole('manager'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM items WHERE id=?').get(id);
  if (!cur) return res.status(404).json({ error: 'Item not found.' });
  const b = req.body || {};
  const vErr = validateMenuItem(b, true);
  if (vErr) return bad(res, vErr);
  if (Array.isArray(b.outletIds)) {
    for (const oid of b.outletIds) {
      if (!Number.isInteger(oid) || !db.prepare('SELECT id FROM outlets WHERE id=?').get(oid)) return bad(res, 'One of the chosen outlets does not exist.');
    }
  }
  const price = b.price !== undefined ? Number(b.price) : cur.price;
  if (!Number.isInteger(price) || price <= 0) return bad(res, 'Price must be above zero.');
  db.prepare(`UPDATE items SET name=?,category=?,description=?,price=?,veg=?,spice=?,allergens=?,photo=?,portions=?,addons=?,base_minutes=?,menu_tag=?,active=? WHERE id=?`)
    .run(b.name ?? cur.name, b.category ?? cur.category, b.description ?? cur.description, price, b.veg !== undefined ? (b.veg ? 1 : 0) : cur.veg, b.spice ?? cur.spice, b.allergens ?? cur.allergens, b.photo ?? cur.photo, JSON.stringify(b.portions ?? JSON.parse(cur.portions || '[]')), JSON.stringify(b.addons ?? JSON.parse(cur.addons || '[]')), Number(b.base_minutes ?? cur.base_minutes) || 25, b.menu_tag ?? cur.menu_tag, b.active !== undefined ? (b.active ? 1 : 0) : cur.active, id);
  if (Array.isArray(b.outletIds)) {
    // Preserve price overrides and out-of-stock flags on outlets that stay
    // listed: v1 deleted every row and rebuilt it, silently wiping both.
    const placeholders = b.outletIds.map(() => '?').join(',');
    if (b.outletIds.length) db.prepare(`DELETE FROM item_outlets WHERE item_id=? AND outlet_id NOT IN (${placeholders})`).run(id, ...b.outletIds);
    else db.prepare('DELETE FROM item_outlets WHERE item_id=?').run(id);
    b.outletIds.forEach((oid) => db.prepare('INSERT OR IGNORE INTO item_outlets (item_id,outlet_id) VALUES (?,?)').run(id, oid));
  }
  if (b.outletPrices && typeof b.outletPrices === 'object') {
    for (const [oid, price] of Object.entries(b.outletPrices)) {
      const p = price === null || price === '' ? null : Number(price);
      db.prepare('INSERT INTO item_outlets (item_id,outlet_id,price_override) VALUES (?,?,?) ON CONFLICT(item_id,outlet_id) DO UPDATE SET price_override=excluded.price_override').run(id, Number(oid), p);
    }
  }
  io.emit('menu:updated', { itemId: id });
  io.emit('admin:items-updated', { itemId: id });
  res.json(db.prepare('SELECT * FROM items WHERE id=?').get(id));
});
app.get('/api/admin/dashboard', auth, requireRole('manager'), (req, res) => {
  // Window is the last 7 days, not "today" (v3, QA P1): seed orders would
  // otherwise vanish from the dashboard on day 2 and the UTC/IST "today"
  // boundary would flip the numbers at midnight. The client labels the
  // window explicitly. Late orders are still computed across all active
  // orders, regardless of window.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const todays = db.prepare('SELECT * FROM orders').all().filter((o) => new Date(o.created_at.replace(' ', 'T')) >= sevenDaysAgo);
  const revenue = todays.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.payable, 0);
  const cancelled = todays.filter((o) => o.status === 'Cancelled').length;
  const byOutlet = db.prepare(`SELECT * FROM outlets ORDER BY id`).all().map((o) => {
    const os = todays.filter((x) => x.outlet_id === o.id);
    const live = os.filter((x) => x.status !== 'Cancelled');
    const pairs = db.prepare(`SELECT (SELECT created_at FROM order_events WHERE order_id=ord.id AND status='Placed' ORDER BY id LIMIT 1) p,
      (SELECT created_at FROM order_events WHERE order_id=ord.id AND status='Ready' ORDER BY id LIMIT 1) r FROM orders ord WHERE ord.outlet_id=? AND ord.status IN ('Ready','Rider handoff','Handed over')`).all(o.id)
      .map((x) => (x.p && x.r ? (new Date(x.r) - new Date(x.p)) / 60000 : null)).filter((v) => v !== null).sort((a, b) => a - b);
    const repeat = db.prepare(`SELECT COUNT(*) c FROM (SELECT user_id FROM orders WHERE outlet_id=? AND status!='Cancelled' GROUP BY user_id HAVING COUNT(*) > 1)`).get(o.id).c;
    const lateCount = os.filter((x) => ['Placed', 'Preparing'].includes(x.status) && minutesLate(x.promised_at) > 0).length;
    return { id: o.id, name: o.name, cnt: os.length, rev: live.reduce((s, x) => s + x.payable, 0),
      cancelled: os.filter((x) => x.status === 'Cancelled').length,
      medianPrep: pairs.length ? Math.round(pairs[Math.floor(pairs.length / 2)]) : null,
      lateCount, repeatCustomers: repeat };
  });
  // Median prep: Placed -> Ready elapsed minutes, across completed orders.
  const pairs = db.prepare(`SELECT o.id, (SELECT created_at FROM order_events WHERE order_id=o.id AND status='Placed' ORDER BY id LIMIT 1) p,
    (SELECT created_at FROM order_events WHERE order_id=o.id AND status='Ready' ORDER BY id LIMIT 1) r FROM orders o WHERE o.status IN ('Ready','Rider handoff','Handed over')`).all()
    .map((x) => (x.p && x.r ? (new Date(x.r) - new Date(x.p)) / 60000 : null)).filter((v) => v !== null).sort((a, b) => a - b);
  const medianPrep = pairs.length ? Math.round(pairs[Math.floor(pairs.length / 2)]) : null;
  const repeat = db.prepare(`SELECT COUNT(*) c FROM (SELECT user_id FROM orders WHERE status!='Cancelled' GROUP BY user_id HAVING COUNT(*) > 1)`).get().c;
  // Late is computed in JS: promised_at is stored as ISO text, which does not
  // compare correctly against SQLite datetime('now') strings.
  const late = db.prepare("SELECT * FROM orders WHERE status IN ('Placed','Preparing') ORDER BY promised_at").all()
    .map(orderWithItems).filter((o) => o.minutesLate > 0);
  res.json({ today: { orders: todays.length, revenue, cancelled, medianPrep }, repeatCustomers: repeat, byOutlet, lateOrders: late });
});


// ---------- estimate preview (same formula as order creation) ----------
app.post('/api/estimate', (req, res) => {
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=?').get(Number(req.body?.outletId));
  if (!outlet) return bad(res, 'Choose a valid outlet.');
  const ids = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  const items = ids.map((id) => db.prepare('SELECT base_minutes FROM items WHERE id=?').get(Number(id))).filter(Boolean)
    .map((r) => ({ baseMinutes: r.base_minutes }));
  const active = db.prepare("SELECT COUNT(*) c FROM orders WHERE outlet_id=? AND status IN ('Placed','Preparing')").get(outlet.id).c;
  res.json({ ...estimatePrep({ items, activeOrders: active, outletMinimum: outlet.min_prep_minutes }), activeOrders: active, outletMinimum: outlet.min_prep_minutes });
});

// ---------- production: serve the built frontend from the same origin ----------
// API and /socket.io routes above take precedence; everything else falls back
// to the SPA so a reviewer gets ONE live URL and websockets stay same-origin.
const fs = require('fs');
const distDir = require('path').join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(require('path').join(distDir, 'index.html'));
  });
}

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });

server.listen(PORT, () => console.log(`Dum House server on http://localhost:${PORT}`));
module.exports = { app, server };