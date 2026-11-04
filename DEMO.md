# Demo walkthrough — get it in 60 seconds

Open **two tabs** on the same URL (locally: `http://localhost:4000` after
`npm start`, or your deployed URL — see `deployment.md`).

## The 5 steps

1. **Tab 1 — sign in as the customer.** Email `customer@demo.in`, password
   `Demo123!`. You land on the menu.
2. **Pick Kondapur.** The outlet selector shows its address, delivery radius
   (8 km) and FSSAI licence `10124012001234`. Prices include 5% GST.
3. **Add Chicken Dum Biryani — Family (serves 4).** Tap Add on that card
   (choose the Family portion). The sticky cart bar appears at the bottom.
4. **Checkout with test UPI.** Open the cart, leave the payment on UPI
   (TEST MODE — no real money), tap "Pay". Note the promised-time box:
   it shows base prep + kitchen queue + the outlet minimum, not a made-up
   number. Your order number is `WEB-…`.
5. **Tab 2 — watch the kitchen.** In Tab 2, sign in as kitchen staff:
   `kitchen@demo.in` / `Demo123!` (Kondapur). **Without refreshing**, the
   new order is already on the dark kitchen display, timer ticking from
   placement, with its promised time and breakdown. Tap "Mark Preparing",
   then "Ready for pickup" — Tab 1's My orders timeline moves live too.

## What to look for after the happy path

- **Late flag (already seeded):** the KDS and dashboard show `WEB-778146`
  (Kukatpally, Mutton Haleem ×3) past its promise — red on the KDS, and a
  manager-alert banner when 10+ minutes late. Customer tracking for that
  order (sign in as customer, My orders) says "Running late — we're on it".
- **Manager override:** sign in as `manager@demo.in` / `Demo123!`, open
  Kitchen, pick an outlet, set an override in minutes on any order — the
  promised time changes and the override is recorded in the order history
  on the tracking page.
- **Out-of-stock, live:** on the KDS, pause any item — it instantly shows
  "Out of stock at this outlet" on the customer menu (open Tab 1's menu
  again; no refresh needed). Tap again to restore it.
- **Payment failure, cart kept:** in checkout, switch to Card and use a
  card ending in `0000`. Payment is declined, **no order is created**, and
  your cart is still there to retry with UPI.
- **Party order rule:** Party orders → pick a date less than 48 hours away
  → the form refuses with a clear error and does not submit. Pick a date
  3+ days away and it saves as "Pending confirmation" (visible in
  Admin → Party enquiries).
- **Menu CMS portion authoring (v2):** sign in as manager, Admin → Menu CMS → Add a menu item, add a portion (e.g. Single ₹200, Family ₹620) and an add-on, save — then as a customer at that outlet, order the new item with the Family portion and the add-on. The authored prices are what checkout charges (server-validated). Uncheck an outlet in the form and the item disappears from that outlet's menu — availability is real, not a label.
- **Coupons & loyalty:** `DIRECT10` = 10% off; `WELCOME100` = ₹100 off over
  ₹499. The customer demo account holds 240 points: 100 points = ₹50 off
  at checkout, and you earn 1 point per ₹20 spent.

## If something looks empty

- Kitchen with no active orders shows "No active orders — new orders will
  appear here instantly". That is the intended empty state, not a bug.
- An empty cart shows "Your cart is empty" in the drawer instead of a
  broken checkout.
