# Technical Design Document — outline (source for the final TDD PDF)

**Project:** Dum House — restaurant chain direct ordering + kitchen display
**Client brief:** Problem #1, Hyderabad biryani chain (fictional brand
"Dum House" for the demo). **GitHub URL:** _placeholder — fill in after
pushing from your own account._ **Live URL:** _placeholder — see
`deployment.md`. No live URL or GitHub URL was created by the builder.

## 1. Architecture and why

One deployable unit: Vite + React frontend served by the same Express
server that owns the API and Socket.io. Same-origin serving removes an
entire class of reviewer failure (CORS splits, websocket proxying) and
makes "one live URL" true. SQLite via `node:sqlite` (Node >= 22) removes
the database server from setup: a reviewer runs `npm run install:all &&
npm run build && npm start` and has the whole product. The cost is
explicit: a single instance with a file database cannot serve the brief's
1,200 orders/hour peak (see §7).

```
Browser ──REST + Socket.io──► Express ──► SQLite (node:sqlite)
   │  rooms: outlet:<id>, order:<no>      │  pure modules:
   └── served from client/dist ───────────► prep.js, pricing.js, kds.js, timewindow.js
```

Why not Next.js / Postgres / a framework: the core slice is small, the
review window is short, and every added layer is a setup failure mode for
a reviewer. The pure modules keep the logic a hiring manager will probe
(prep, pricing, KDS order) testable without a server.

## 2. Data model

`users` (role customer/kitchen/manager; kitchen staff carry `outlet_id`;
`points`; `marketing_opt_in`, default 0) · `outlets` (FSSAI, radius,
min_prep_minutes, lat/lon for distance) · `items` (GST-inclusive price,
veg, spice, allergens, photo, portions/add-ons JSON, base_minutes,
menu_tag) · `item_outlets` (availability, out_of_stock, price_override)
· `coupons` · `orders` (+ `request_key` idempotency, estimate breakdown,
promised_at, promise_override) · `order_items` · `order_events` (audit:
actor, from→to, when) · `notifications` (mock WhatsApp/SMS log, one row
per status change) · `points_ledger` (earned/redeemed per order) ·
`party_enquiries` (+ manager_note, Confirmed/Declined); `orders.delivery_address` (checkout address, shown on tracking + KDS).

## 3. Main flows

- **Order:** area pick → haversine distance vs outlet radius → nearest
  in-radius outlet auto-selected, switching only within radius → menu
  (time-windowed, stock-aware) → cart → server recomputes totals → mock
  test payment → order created → Socket.io `order:created` to the outlet
  room + `order:updated` to the order room.
- **Kitchen:** joins `outlet:<id>`, sorted late-first then by promise;
  stages New → Preparing → Ready for pickup → Rider handoff → Handed
  over; timers derive from `placed_at`/`promised_at` on every tick (no
  local countdown state); reconnect rejoins + refetches.
- **Admin:** menu CRUD + per-outlet overrides, dashboard computed from
  the orders table, party Confirm/Decline with a note the customer sees.
- **Party:** 48h notice enforced server-side (client mirrors it); manager
  confirms/declines; customer sees status + note in My orders.

## 4. How the AI / automation works — and where it is wrong

No LLM is called. The "AI prep-time" is the deterministic estimator in
`server/src/prep.js`: `base = slowest item + 3 min/extra line`,
`queueLoad = min(active orders × 4, 30)`, `promised = max(total, outlet
minimum)`. The breakdown is shown at checkout and on the KDS. It is wrong
when: the kitchen runs slower than base times, a very large order lands,
staff are short, or an item's base time is mis-estimated. Mitigations are
the brief's own: the outlet-minimum floor, manager override (audited),
the 10+ minute late alert + customer "Running late" update, and
suggestions that never auto-add. Reorder suggestions are the customer's
own past-order items, most recent first. Notifications are mocked rows,
labelled "mock" in the UI — not real WhatsApp/SMS sends.

## 5. UI and design decisions

Uber/Zerodha minimal: off-white `#FAFAF8`, white cards, 1px `#E7E5E0`
borders, ink `#111111`, muted `#6B6B6B`, solid black primary buttons,
saffron `#C2410C` only for late/highlight accents. Instrument Serif
(400 + italic) for display headings only — wordmark, hero, section
titles, food names; Inter (400–700) for everything else. No gradients,
no heavy shadows, no decorative emoji. Small uppercase letter-spaced
eyebrows carry FSSAI/section labels. The KDS is the deliberate exception:
dark, Inter bold, huge type, readable from 2 metres, no serif, colour
never the only signal ("Late", "Ready — for pickup" in words). Every
screen has loading, empty and error states (empty cart, no active
orders, no matches, failed fetch with retry). Mobile: single-column
checkout, sticky bottom cart bar, large tap targets. Accessibility
basics: real form labels, focus-visible outlines, text alongside colour.

## 6. Must Have → where it lives (reviewer tick-list)

| Brief Must Have | Implemented in |
|---|---|
| Outlet by location + delivery radius | Menu page: area picker, haversine distance, nearest in-radius auto-route, "outside delivery radius" state, geolocation as optional shortcut |
| Menu: photos, portions/add-ons, search, veg filter, symbols, spice, allergens, GST + FSSAI | Menu cards + checkout drawer (GST breakdown, FSSAI per outlet) |
| Cart, coupons, loyalty, test UPI/Card, <60s checkout, marketing opt-in | Cart drawer; opt-in checkbox unchecked by default, stored, toggleable in My orders |
| Central menu CMS: CRUD, price by city, outlet availability, time-based menus, photos, veg, spice, portion/add-on authoring | Admin → Menu CMS: Hyderabad base price + per-outlet override that really changes that outlet's price; Lunch/Dinner/All day windows enforced client + server; portions/add-ons authored in the form and orderable immediately; outlet availability is real — an item with no item_outlets row for an outlet is absent from that outlet's menu and cannot be ordered there |
| Kitchen display per outlet | Kitchen view: live socket, timers, 5 stages, late red + 10+ min alert, override, stock toggle → live menu pause |
| Loyalty earn/redeem | Checkout toggle (100 pts = ₹50, capped), balance + per-order history in My orders |
| Party form + catering confirmation | Party orders tab (48h enforced) + Admin → Party enquiries (Confirm/Decline + note) + customer status in My orders |
| Dashboard by outlet | Admin → Dashboard: orders, revenue, median prep, late count, cancellations, repeat customers — all per outlet, from real DB data |
| Prep estimator + reorder + status notifications | Checkout/KDS breakdown, "Order again" (explicit Add only), mock notification log on tracking |
| Roles | Customer / kitchen (own outlet only) / manager (covers outlet manager + central admin — stated explicitly) |

## 7. Assumptions (labelled)

- **[A1]** Brand "Dum House", outlet addresses, FSSAI numbers, phone
  numbers and demo accounts are fictional demo data, formatted realistically.
- **[A2]** All outlets are in Hyderabad, so "price by city" = one Hyderabad
  base price + per-outlet overrides (the brief's multi-city case is not
  demonstrated with invented cities).
- **[A3]** Time windows are Lunch 11:00–16:00 IST, Dinner 18:00–24:00 IST;
  the brief does not specify hours, so these are the demo's stated choice.
- **[A4]** Distances are haversine straight-line approximations from
  approximate outlet/area coordinates, labelled "approx." in the UI — not
  road distances.
- **[A5]** "Manager" merges the brief's outlet manager and central
  marketing/admin roles; no fourth role is presented.
- **[A6]** The ROI math is the brief's, not inflated: 12% of app sales
  (55% of ₹96 crore = ₹52.8 crore at 27% commission) moved to direct at
  12% costs saves 15 points on ₹6.336 crore = ₹95.04 lakh; plus 30 bulk
  orders/month recovered at ₹5,400 margin × 12 = ₹19.44 lakh; total
  **₹1.14 crore/year** as stated in the brief. This demo does not claim
  to have achieved any of it.
- **[A7]** Seeded sample orders match the brief exactly (WEB-778120 ₹1180
  UPI Preparing; WEB-778131 ₹640 Card Ready; WEB-778146 ₹1050 UPI Late).

## 8. What was cut, and what next

Cut (deliberate, not half-built): delivery-app integration, own rider app,
billing/inventory replacement (brief out-of-scope); real payment gateway
and real WhatsApp/SMS (mocked, labelled); multi-city pricing (see A2);
per-item scheduling beyond Lunch/Dinner/All day. (v2 closed the former
CMS portion-editor gap: portions/add-ons are now authored in the CMS.)
Next, in order: (1) Postgres + Redis pub/sub + stateless instances for
the 1,200 orders/hour peak; (2) real payment gateway in test→live mode
and a real notification provider behind the notification log; (3) a real
`item_prices` table per city; (4) road-distance routing and a rider
handoff scan; (5) DPDP consent audit export.

## 9. Constraints shown in the product

DPDP Act 2023: role-based access, marketing opt-in (default off),
no real personal data in the repo. Socket security (v3): order rooms
require a JWT for that order's customer, its outlet's kitchen staff, or
a manager — guessing an order number alone gets nothing; outlet rooms
carry only public menu data. CORS: strict allowlist when
`FRONTEND_URL` is set, same-origin reflection when unset (Render). GST: prices include 5% GST, stated on
menu and checkout with the included-GST split. KDS: cheap Android tablet
readability (dark, huge type). Scale limit: stated in README,
deployment.md and here — SQLite single instance is a demo, not peak
architecture.
