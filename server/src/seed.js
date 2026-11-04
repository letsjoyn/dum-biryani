const bcrypt = require('bcryptjs');
const { db } = require('./db');

const IMG = {
  chickenBiryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80&auto=format&fit=crop',
  biryani2: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80&auto=format&fit=crop',
  biryani3: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80&auto=format&fit=crop',
  mutton: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80&auto=format&fit=crop',
  haleem: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80&auto=format&fit=crop',
  chicken65: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?w=800&q=80&auto=format&fit=crop',
  curry: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80&auto=format&fit=crop',
  dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80&auto=format&fit=crop',
  dessert2: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80&auto=format&fit=crop',
  veg: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80&auto=format&fit=crop',
  raita: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=80&auto=format&fit=crop',
  kebab: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80&auto=format&fit=crop',
  bread: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80&auto=format&fit=crop',
  combo: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80&auto=format&fit=crop',
  berry: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80&auto=format&fit=crop',
  soda: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80&auto=format&fit=crop',
  rice: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800&q=80&auto=format&fit=crop',
  drink: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80&auto=format&fit=crop',
};

const BIRYANI_ADDONS = JSON.stringify([
  { label: 'Extra raita', price: 49 },
  { label: 'Extra salan', price: 60 },
  { label: 'Extra papad', price: 29 },
]);

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM outlets').get().c;
  if (count > 0) { console.log('Seed skipped: data already exists.'); return; }
  const hash = bcrypt.hashSync('Demo123!', 10);
  // lat/lon are approximate outlet locations used for the delivery-area
  // distance calculation (haversine, in the client). All outlets are Hyderabad.
  const outlets = [
    ['Kondapur', 'Plot 42, Botanical Garden Road, Kondapur, Hyderabad 500084', '040-4855-1201', '10124012001234', 35, 8, 17.461, 78.342],
    ['Gachibowli Cloud Kitchen', 'Financial District, Nanakramguda, Gachibowli, Hyderabad 500032', '040-4855-1202', '10124012001235', 30, 10, 17.440, 78.350],
    ['Kukatpally', 'Main Road, Kukatpally, Hyderabad 500072', '040-4855-1203', '10124012001236', 35, 8, 17.484, 78.408],
    ['Banjara Hills', 'Road No. 12, Banjara Hills, Hyderabad 500034', '040-4855-1204', '10124012001237', 30, 6, 17.415, 78.437],
  ];
  const outletIds = outlets.map((o) => db.prepare(
    'INSERT INTO outlets (name,address,phone,fssai,min_prep_minutes,delivery_radius_km,lat,lon) VALUES (?,?,?,?,?,?,?,?)').run(...o).lastInsertRowid);

  const users = [
    ['Demo Customer', 'customer@demo.in', hash, 'customer', null, 240, '9876500001'],
    ['Kondapur Kitchen', 'kitchen@demo.in', hash, 'kitchen', outletIds[0], 0, '9876500002'],
    ['Demo Manager', 'manager@demo.in', hash, 'manager', null, 0, '9876500003'],
  ];
  const userIds = users.map((u) => db.prepare(
    'INSERT INTO users (name,email,password_hash,role,outlet_id,points,phone) VALUES (?,?,?,?,?,?,?)').run(...u).lastInsertRowid);
  const customerId = userIds[0];

  // name, category, desc, price(single), veg, spice, allergens, photo, portions, addons, base, tag
  // Portion prices: for biryanis the "price" column is the Single price; the
  // Family price is stored in the portions JSON (see item insert below).
  const items = [
    ['Chicken Dum Biryani', 'Biryani', 'Slow-cooked on dum with saffron, fried onion and mint. Our signature.', 299, 0, 'Medium', 'Dairy, Gluten', IMG.chickenBiryani, JSON.stringify([{ label: 'Single', price: 299 }, { label: 'Family (serves 4)', price: 900 }]), BIRYANI_ADDONS, 30, 'All day'],
    ['Mutton Dum Biryani', 'Biryani', 'Tender mutton layered with basmati, saffron and whole spices.', 349, 0, 'Hot', 'Dairy, Gluten', IMG.mutton, JSON.stringify([{ label: 'Single', price: 349 }, { label: 'Family (serves 4)', price: 1099 }]), BIRYANI_ADDONS, 35, 'All day'],
    ['Veg Biryani', 'Biryani', 'Seasonal vegetables, paneer and saffron rice, sealed and slow-cooked.', 260, 1, 'Medium', 'Dairy, Gluten', IMG.veg, JSON.stringify([{ label: 'Single', price: 260 }, { label: 'Family (serves 4)', price: 799 }]), BIRYANI_ADDONS, 25, 'All day'],
    ['Paneer Tikka Biryani', 'Biryani', 'Char-grilled paneer tikka folded into dum rice.', 289, 1, 'Medium', 'Dairy, Gluten', IMG.biryani2, JSON.stringify([{ label: 'Single', price: 289 }, { label: 'Family (serves 4)', price: 849 }]), BIRYANI_ADDONS, 28, 'Dinner'],
    ['Egg Biryani', 'Biryani', 'Masala eggs layered with dum rice and fried onion.', 229, 0, 'Medium', 'Egg, Dairy, Gluten', IMG.biryani3, JSON.stringify([{ label: 'Single', price: 229 }, { label: 'Family (serves 4)', price: 699 }]), BIRYANI_ADDONS, 22, 'All day'],
    ['Mutton Haleem', 'Starters', 'Slow-cooked wheat, lentils and shredded mutton, topped with fried onion.', 350, 0, 'Medium', 'Gluten, Dairy', IMG.haleem, '[]', '[]', 20, 'Dinner'],
    ['Chicken 65', 'Starters', 'Fiery, curry-leaf tossed fried chicken — a Hyderabad classic.', 279, 0, 'Very Hot', 'Gluten', IMG.chicken65, '[]', '[]', 18, 'All day'],
    ['Chicken Tikka Kebab', 'Starters', 'Charcoal-grilled tikka with mint chutney and onion rings.', 319, 0, 'Medium', 'Dairy', IMG.kebab, '[]', '[]', 20, 'Dinner'],
    ['Mirchi ka Salan', 'Sides', 'Peanut-sesame curry with large green chillies. The classic biryani partner.', 120, 1, 'Hot', 'Peanut, Sesame', IMG.curry, '[]', '[]', 10, 'All day'],
    ['Bagara Rice', 'Sides', 'Tempered rice with whole spices — lighter than biryani, same comfort.', 179, 1, 'Mild', 'Dairy', IMG.rice, '[]', '[]', 15, 'Lunch'],
    ['Raita', 'Sides', 'Chilled curd with onion, tomato and coriander.', 49, 1, 'Mild', 'Dairy', IMG.raita, '[]', '[]', 5, 'All day'],
    ['Double ka Meetha', 'Desserts', 'Shahi tukda: fried bread soaked in saffron milk, topped with nuts.', 140, 1, 'Mild', 'Dairy, Gluten, Nuts', IMG.dessert, '[]', '[]', 8, 'All day'],
    ['Qubani ka Meetha', 'Desserts', 'Stewed apricots with cream — the Hyderabadi wedding dessert.', 160, 1, 'Mild', 'Dairy, Nuts', IMG.berry, '[]', '[]', 8, 'Dinner'],
    ['Gulab Jamun (2 pc)', 'Desserts', 'Warm khoya jamuns in rose syrup.', 99, 1, 'Mild', 'Dairy, Gluten', IMG.dessert2, '[]', '[]', 5, 'All day'],
    ['Butter Naan', 'Breads', 'Tandoor-baked, brushed with butter.', 59, 1, 'Mild', 'Gluten, Dairy', IMG.bread, '[]', '[]', 10, 'Dinner'],
    ['Mango Lassi', 'Drinks', 'Thick curd, mango pulp and a pinch of cardamom.', 119, 1, 'Mild', 'Dairy', IMG.drink, '[]', '[]', 5, 'Lunch'],
    ['Masala Coke / Soda', 'Drinks', 'Chilled soda with lemon and chaat masala.', 79, 1, 'Mild', 'None', IMG.soda, '[]', '[]', 3, 'All day'],
    ['Haleem + Biryani Combo', 'Combos', 'Mini mutton haleem with a single chicken dum biryani.', 549, 0, 'Medium', 'Gluten, Dairy', IMG.combo, '[]', BIRYANI_ADDONS, 30, 'Dinner'],
  ];
  const itemIds = {};
  items.forEach((it) => {
    const id = db.prepare(`INSERT INTO items (name,category,description,price,veg,spice,allergens,photo,portions,addons,base_minutes,menu_tag)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(...it).lastInsertRowid;
    itemIds[it[0]] = id;
    outletIds.forEach((oid) => db.prepare('INSERT INTO item_outlets (item_id,outlet_id,out_of_stock) VALUES (?,?,0)').run(id, oid));
  });
  // One realistic gap: Mango Lassi out of stock at Kukatpally, to demo the pause.
  db.prepare('UPDATE item_outlets SET out_of_stock=1 WHERE item_id=? AND outlet_id=?').run(itemIds['Mango Lassi'], outletIds[2]);

  db.prepare("INSERT INTO coupons VALUES ('DIRECT10','percent',10,0,'10% off direct orders')").run();
  db.prepare("INSERT INTO coupons VALUES ('WELCOME100','flat',100,499,'Rs 100 off on orders above Rs 499')").run();

  const now = new Date();
  const iso = (mins) => new Date(now.getTime() + mins * 60000).toISOString();
  const mkOrder = (orderNo, outletIdx, status, itemsList, subtotal, payable, payment, placedAgo, promisedIn, est) => {
    const oid = db.prepare(`INSERT INTO orders (order_no,user_id,outlet_id,status,subtotal,payable,gst_amount,payment_method,payment_ref,estimate_minutes,estimate_breakdown,promised_at,created_at,points_earned)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderNo, customerId, outletIds[outletIdx], status, subtotal, payable,
      Math.round(payable * 5 / 105 * 100) / 100, payment, payment === 'UPI' ? 'UPI·demo' : 'Card·4242',
      est, JSON.stringify({ base: est, queueLoad: 0, total: est, promised: est }), iso(promisedIn), iso(-placedAgo), Math.floor(payable / 20)).lastInsertRowid;
    itemsList.forEach(([name, portion, qty, price]) => db.prepare(
      'INSERT INTO order_items (order_id,item_id,item_name,portion,addons,qty,unit_price) VALUES (?,?,?,?,?,?,?)')
      .run(oid, itemIds[name], name, portion, '[]', qty, price));
    db.prepare('INSERT INTO order_events (order_id,status,to_status,created_at) VALUES (?,?,?,?)').run(oid, 'Placed', 'Placed', iso(-placedAgo));
    db.prepare('INSERT INTO notifications (order_id,kind,message,created_at) VALUES (?,?,?,?)').run(oid, 'transactional', `WhatsApp/SMS update sent — mock: your order ${orderNo} is placed.`, iso(-placedAgo));
    if (status === 'Handed over') {
      // A handed-over order must have passed through Ready, or the median
      // prep calculation (Placed -> Ready) has no pair for it.
      db.prepare('INSERT INTO order_events (order_id,status,to_status,created_at) VALUES (?,?,?,?)').run(oid, 'Ready', 'Ready', iso(-placedAgo + 20));
      db.prepare('INSERT INTO notifications (order_id,kind,message,created_at) VALUES (?,?,?,?)').run(oid, 'transactional', `WhatsApp/SMS update sent — mock: your order ${orderNo} is now Ready.`, iso(-placedAgo + 20));
    }
    if (status !== 'Placed') {
      db.prepare('INSERT INTO order_events (order_id,status,to_status,created_at) VALUES (?,?,?,?)').run(oid, status, status, iso(-placedAgo + 25));
      db.prepare('INSERT INTO notifications (order_id,kind,message,created_at) VALUES (?,?,?,?)').run(oid, 'transactional', `WhatsApp/SMS update sent — mock: your order ${orderNo} is now ${status}.`, iso(-placedAgo + 25));
    }
    db.prepare('INSERT INTO points_ledger (user_id,order_id,delta,reason,created_at) VALUES (?,?,?,?,?)').run(customerId, oid, Math.floor(payable / 20), `Earned on order ${orderNo}`, iso(-placedAgo));
    return oid;
  };
  // Brief sample orders, priced to match exactly.
  mkOrder('WEB-778120', 0, 'Preparing', [['Chicken Dum Biryani', 'Family (serves 4)', 1, 900], ['Double ka Meetha', '', 2, 140]], 1180, 1180, 'UPI', 45, 45, 45);
  mkOrder('WEB-778131', 1, 'Ready', [['Veg Biryani', 'Single', 2, 260], ['Mirchi ka Salan', '', 1, 120]], 640, 640, 'Card', 70, 40, 40);
  mkOrder('WEB-778146', 2, 'Preparing', [['Mutton Haleem', '', 3, 350]], 1050, 1050, 'UPI', 55, -15, 40); // promised 15 min ago => Late
  // A couple of extra completed orders so the dashboard + reorder list feel real.
  mkOrder('WEB-778100', 0, 'Handed over', [['Mutton Dum Biryani', 'Single', 1, 349], ['Raita', '', 1, 49]], 398, 398, 'UPI', 300, 35, 35);
  mkOrder('WEB-778090', 3, 'Handed over', [['Chicken Dum Biryani', 'Single', 2, 299], ['Chicken 65', '', 1, 279]], 877, 877, 'Card', 1500, 40, 40);
  console.log('Seed complete: 4 outlets, 18 items, 3 demo users, 5 orders, 2 coupons.');
}

if (require.main === module) seed();
module.exports = { seed };
