const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'app.db') : (process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','kitchen','manager')),
  outlet_id INTEGER, points INTEGER NOT NULL DEFAULT 0, phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outlets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL,
  fssai TEXT NOT NULL, min_prep_minutes INTEGER NOT NULL DEFAULT 30,
  delivery_radius_km REAL NOT NULL DEFAULT 8, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL, veg INTEGER NOT NULL DEFAULT 0,
  spice TEXT NOT NULL DEFAULT 'Medium', allergens TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '', portions TEXT NOT NULL DEFAULT '[]',
  addons TEXT NOT NULL DEFAULT '[]', base_minutes INTEGER NOT NULL DEFAULT 25,
  menu_tag TEXT NOT NULL DEFAULT 'All day', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS item_outlets (
  item_id INTEGER NOT NULL, outlet_id INTEGER NOT NULL,
  out_of_stock INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, outlet_id),
  FOREIGN KEY (item_id) REFERENCES items(id), FOREIGN KEY (outlet_id) REFERENCES outlets(id)
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY, kind TEXT NOT NULL, value INTEGER NOT NULL,
  min_order INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL, outlet_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Placed',
  subtotal INTEGER NOT NULL, coupon_code TEXT, coupon_off INTEGER NOT NULL DEFAULT 0,
  loyalty_off INTEGER NOT NULL DEFAULT 0, points_used INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0, payable INTEGER NOT NULL,
  gst_amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL,
  payment_ref TEXT, estimate_minutes INTEGER NOT NULL DEFAULT 30,
  estimate_breakdown TEXT NOT NULL DEFAULT '{}', promised_at TEXT NOT NULL,
  promise_override INTEGER, history_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (outlet_id) REFERENCES outlets(id)
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL, item_name TEXT NOT NULL, portion TEXT NOT NULL DEFAULT '',
  addons TEXT NOT NULL DEFAULT '[]', qty INTEGER NOT NULL, unit_price INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'transactional', message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  order_id INTEGER, delta INTEGER NOT NULL, reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS party_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  name TEXT NOT NULL, phone TEXT NOT NULL, outlet_id INTEGER NOT NULL,
  event_at TEXT NOT NULL, guests INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending confirmation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (outlet_id) REFERENCES outlets(id)
);
`);

// Idempotent migrations for the audit trail / idempotency guard.
for (const [table, col, def] of [
  ['order_events', 'actor_name', 'TEXT NOT NULL DEFAULT \'\''],
  ['order_events', 'from_status', 'TEXT NOT NULL DEFAULT \'\''],
  ['order_events', 'to_status', 'TEXT NOT NULL DEFAULT \'\''],
  ['orders', 'request_key', 'TEXT'],
  ['outlets', 'lat', 'REAL'],
  ['outlets', 'lon', 'REAL'],
  ['users', 'marketing_opt_in', 'INTEGER NOT NULL DEFAULT 0'],
  ['item_outlets', 'price_override', 'INTEGER'],
  ['party_enquiries', 'manager_note', "TEXT NOT NULL DEFAULT ''"],
  ['orders', 'delivery_address', "TEXT NOT NULL DEFAULT ''"],
]) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* column already exists */ }
}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_request_key ON orders(request_key) WHERE request_key IS NOT NULL'); } catch {}

module.exports = { db };
