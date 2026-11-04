> **Current truth (v3, supersedes the v1 notes below):** tests are 25 (not 20),
> CMS portion/add-on authoring is DONE (the v1 "honest subset" is closed),
> and the v3 QA fixes below apply. The v1 sections are kept as history.

# Verification — what was actually run, and what it proved

Environment: Node v24.22.1, npm 10.9.4. All commands run from the repo root
unless stated. No secrets were used or stored; test databases lived in /tmp.

## Commands + results (final run)

```
cd server && npm test
# 20 tests, 20 pass, 0 fail:
# prep (6): base, queue load + cap, outlet-minimum floor, extra lines,
#   override respected/invalid ignored, minutesLate
# pricing (6): GST split, coupon + loyalty stacking, flat coupon minimum,
#   loyalty cap, payable = subtotal, server ignores client-sent totals
# validation (2): quantity bounds, party 48h notice
# kds (2): late-first sort, sort does not mutate input
# timewindow + overrides (4): lunch/dinner windows, labels, override keeps portion deltas

cd client && npm run build
# vite build OK (61 modules, ~234 kB JS, ~6.3 kB CSS)
# Built CSS contains "Instrument Serif" and palette #FAFAF8;
# index.html contains the Google Fonts link (Instrument Serif + Inter).
```

## API + socket flow (fresh seeded DB, server on :4123, scripted curl/Python)

- Logins OK for all three demo roles; customer starts with 240 points.
- Menu: 18 items at Kondapur; outlets return lat/lon + FSSAI + radius.
- Seed orders match the brief exactly: WEB-778120 ₹1180 UPI Preparing
  (Chicken Dum Biryani family ×1 + Double ka Meetha ×2); WEB-778131 ₹640
  Card Ready (Veg Biryani ×2 + Mirchi ka Salan ×1); WEB-778146 ₹1050 UPI
  Preparing, 15 min past promise = Late (Mutton Haleem ×3).
- Card ending `0000` → HTTP 402, order count unchanged, no order created.
- Order at overridden price: manager sets Kondapur Chicken Dum override
  319 → menu shows Single 319 / Family 920 (delta preserved), Gachibowli
  unchanged at 299/900, order payable 319. Duplicate request key returns
  the original order (HTTP 200, same order number), no duplicate.
- Time window enforced server-side: at IST 08:xx, a Dinner item order →
  HTTP 400 "not available right now — Available at dinner, 18:00-24:00 IST".
- Full stage flow via kitchen role: Preparing → Ready → Rider handoff →
  Handed over; invalid jump (Preparing → Handed over) → HTTP 400.
- Audit trail on the order: Placed (by Demo Customer) → … → Handed over
  (by Kondapur Kitchen), with from→to on every step; 5 mock notification
  rows (placed + each status change) visible on tracking.
- Loyalty ledger: earned rows per seed order + the new order; marketing
  opt-in PATCH → read-back true.
- Party: <48h → HTTP 400; 72h → Pending confirmation; manager Confirm +
  note → customer "My party enquiries" shows Confirmed + note.
- Dashboard (fresh seed): per-outlet orders/revenue/median prep/late/
  cancelled/repeat — Kondapur median 20 min, Gachibowli 25 min,
  Kukatpally lateCount 1, Banjara Hills 0 orders (honest zeros, not filler).
- Socket.io: client joining `outlet:1` receives `order:created` for a new
  order without refresh; a stock toggle emits `menu:updated` and the menu
  API then shows that item out of stock.
- Production path: `NODE_ENV=production` without `JWT_SECRET` → exit 1
  with "FATAL: JWT_SECRET must be set in production"; with a test secret,
  the server serves the SPA at `/`, `/api/health` → `{"ok":true}`, and an
  unknown SPA route → HTTP 200 (SPA fallback, API routes take precedence).

## Bugs found by verification and fixed (not hidden)

1. Dashboard late list compared ISO timestamps against SQLite
   `datetime('now')` strings and returned 0 late orders. Fixed: late is
   computed in JS from parsed timestamps. Re-verified: WEB-778146 appears.
2. Order numbers went backwards (last-inserted seed order was 778090, so
   the next was 778091). Fixed: next number = max across all orders + 1.
3. Seeded Handed-over orders had no Ready event, skewing median prep.
   Fixed: seed inserts a Ready event for handed-over orders.
4. Test runner initially used `node --test tests/` which Node 24 treated
   as a module path. Fixed: explicit test file list in package.json.

## Full Must Have tick-list (final report summary)

1. Ordering by location + radius — DONE (area picker, haversine,
   nearest in-radius auto-route, outside-radius state, optional geolocation).
2. Menu (photos, portions, add-ons, filters, symbols, spice, allergens,
   GST, FSSAI) — DONE.
3. Cart/checkout, coupons, loyalty, test payment, marketing opt-in — DONE
   (opt-in unchecked by default, stored, toggleable; order updates are
   transactional and do not depend on it).
4. Central menu CMS — DONE (v2/v3 update to the v1 note): per-outlet overrides
   really change prices; Lunch/Dinner/All day windows enforced both sides;
   portion/add-on authoring IS built — managers author portions/add-ons in
   the form and they are orderable immediately.
5. Kitchen display — DONE (5 stages incl. Rider handoff, late-first sort,
   ticking elapsed + remaining, late red + 10+ min alert, override, live
   stock pause via socket).
6. Loyalty — DONE (balance, earn, redeem capped, per-order history).
7. Party orders + catering confirmation — DONE (48h server-enforced,
   manager Confirm/Decline + note, customer sees status + note).
8. Dashboard by outlet — DONE (orders, revenue, median prep, late,
   cancellations, repeat customers per outlet, from real DB data).
9. AI/automation — DONE as a deterministic, explained estimator (no LLM,
   no fake AI text) + reorder suggestions (never auto-add) + mocked
   notification log, labelled "mock".
10. Roles — DONE (customer / kitchen own-outlet only / manager covering
    outlet manager + central admin, stated explicitly in README + TDD).

## Deliberately cut / honest subsets (not presented as features)

- Multi-city pricing: all outlets are Hyderabad, so "price by city" is
  one Hyderabad base price + per-outlet overrides. No invented cities.
- Real payment gateway, real WhatsApp/SMS, delivery-app integration,
  rider app, billing/inventory replacement — out of scope per the brief;
  payment is TEST MODE mock, notifications are labelled mock rows.
- Scale: SQLite single instance is a demo, NOT 1,200 orders/hour
  architecture. Next step is Postgres + Redis + horizontal instances.
- No live deployment and no GitHub URL were created by the builder:
  `deployment.md` and `TDD-OUTLINE.md` carry placeholders for the user
  to fill after deploying from their own account. Nothing in this repo
  claims a live URL.

## Not verified by automation (reviewer should click through)

- Visual check on a real phone width and on a cheap Android tablet (CSS
  is responsive and KDS type is large, but no device lab run was done).
- Unsplash food photos load from the public internet; if offline, images
  hide gracefully (onError) and names/prices remain fully usable.

## v2 iteration pass — audit, fixes, re-verification

Audit method: server started on a fresh seeded DB, client rebuilt, every
role walked through the API + socket layer (no live-browser tool is
available to this agent, so layout was audited from the built CSS/JSX
against the named viewports and re-checked in the built output; a
separate visual QA pass is still the right final check on a real device).

### Issues found in v1 and fixed in v2

| # | Screen / viewport | Issue | Fix | Re-checked |
|---|---|---|---|---|
| V2-1 | Menu CMS, all | A portions value of the string `"oops"` was accepted and stored; the menu card then crashed calling `.find` on a string, breaking the whole menu. | New `server/src/validate.js` (unit-tested): portions/add-ons must be lists with labels and valid prices, duplicate labels rejected, menu tag/spice/base minutes validated. | API: `portions:"oops"` → 400, nothing persisted; tests 24/24. |
| V2-2 | Menu CMS, all | An invalid outlet-price override was rejected only AFTER the item was inserted, leaving a half-created item. | All validation runs before any DB mutation in POST and PUT. | API: bad override → 400, item absent afterwards. |
| V2-3 | Menu + ordering, all | CMS "Available at outlets" was ignored: an item checked only for Gachibowli appeared on Kondapur's menu and could be ordered there. | `/api/menu` now joins `item_outlets` (row required); ordering without a row → 400 "not available at this outlet". | API: Gachibowli-only item hidden at outlet 1, order at 1 → 400, order at 2 → 201. |
| V2-4 | Menu CMS, all | Editing an item's outlet list deleted every `item_outlets` row and rebuilt it, silently wiping price overrides and out-of-stock flags. | PUT now deletes only rows leaving the list and inserts only missing rows; overrides/stock on staying outlets are preserved. | API: override 319 survived an edit that re-saved the outlet list. |
| V2-5 | Menu CMS, all (the v1 partial) | No UI to author portions/add-ons; new items were single-price only. | Portion + add-on editors in the Admin form (add/remove rows, absolute portion prices); save normalises blank rows; server validates. | API: item created with Single 200 / Family 620 + Extra raita 40, ordered Family+addon → payable ₹660 exactly. Admin table shows portion/add-on counts. |
| V2-6 | KDS, manager | Switching outlet never left the old socket room, and orders from the old outlet were added to the new outlet's list. | Server `leave-outlet` handler; client leaves on cleanup and filters `order:created`/`order:updated` by the current outlet. | Code + socket flow re-checked; KDS list is outlet-scoped. |
| V2-7 | Menu, non-IST browsers | Time-window display used the browser's local hour, so a reviewer outside IST saw wrong lunch/dinner availability (server still enforced correctly). | Client `isInWindow` now uses IST via `Intl` (same method as the server). | Built JS re-checked. |
| V2-8 | Menu → checkout, outlet switch | Cart kept the old outlet's unit prices after switching outlet, so checkout could show a price the server would not charge. | Cart is repriced from the new outlet's menu on outlet change; items the new outlet does not serve (or that are out of stock) leave the cart. | Logic in `App.jsx`; server still recomputes totals as the authority. |
| V2-9 | Checkout, all | An empty card number was accepted as a test payment (server fell back to `Card·4242`). | Server now requires a 4-digit card last-4 for Card payments; client blocks submit with a clear error for a missing card number. | API: empty card → 400; card ending 0000 → 402, no order. |
| V2-10 | KDS stock, all | Pausing an item that was not available at an outlet created an availability row for it. | Stock toggle returns 404 when no `item_outlets` row exists. | API: toggle on unavailable item → 404. |
| V2-11 | Menu, all | Items with allergens "None" showed no allergen information at all. | Menu cards now always show `Allergens: …` (including "None"). | Built output re-checked. |
| V2-12 | Menu suggestions | "Order again" could add an out-of-stock or out-of-window item that checkout would then reject. | Suggestion Add now checks stock + window first, with a clear message. | Code re-checked. |
| V2-13 | Layout, laptop 1440px | Content column capped at 1080px left wide empty margins and the menu was a single narrow-feeling column at 1440px. | `.wrap` widened to 1240px; menu grid is 4 columns ≥1200px, 3 at 900–1200px, 2 at 580–900px, 1 below. | Built CSS contains `max-width:1240px` and the new grid breakpoints. |
| V2-14 | Layout, mobile 390/360px | 7-column dashboard/admin tables and 2-column admin/party forms squeezed or overflowed at phone width. | All tables wrapped in a horizontal-scroll container; admin/party forms collapse to one column ≤640px via `.form-grid-2`/`.form-grid-3`. | Built CSS contains `.table-scroll` and `.form-grid-2`. |
| V2-15 | Tap targets, mobile | Category chips (~30px tall), small buttons (36px) and KDS stock buttons (40px) were below the 44px touch target. | Chips and small buttons are now 44px minimum height; KDS stock buttons are 52px with 16px text. | Built CSS re-checked. |
| V2-16 | Topbar, mobile 360px | Brand + nav + user name + two buttons could overflow the 360px bar. | User name hides ≤640px, brand shrinks to 22px, actions gap tightens. | CSS re-checked. |
| V2-17 | KDS tablet 768px portrait | 2-column KDS grid stayed 2-column down to 700px, cramping cards at 768px. | KDS grid collapses to one column ≤900px; timer/h2 shrink ≤480px. | Built CSS re-checked. |
| V2-18 | Sticky cart, mobile | The whole sticky bar was clickable (a `div` onClick) with a button inside — poor keyboard/screen-reader behaviour. | Bar is no longer clickable; only the "View cart" button opens the cart. | Code re-checked. |
| V2-19 | Forms, customer flows | Area/outlet selects, login, party and coupon fields had visual labels but no programmatic label association. | `htmlFor`/`id` added for area, outlet, login (name/email/password), party (all fields) and coupon; party date picker also gets a 48h minimum attribute (server still enforces it). | Code re-checked. Admin-form labels remain visually adjacent (manager tool); see remaining gaps. |
| V2-20 | Menu images | Images were lazy-loaded but had no `decoding` hint. | `decoding="async"` added to menu images. | Built output re-checked. |

### v2 re-verification (fresh DB, server :4123, after rebuild)

```
cd server && npm test        # 24 tests, 24 pass, 0 fail (20 v1 + 4 new admin-validation tests)
cd client && npm run build   # vite build OK; CSS contains Instrument Serif, #FAFAF8, .table-scroll, .form-grid-2, max-width:1240px
# API + socket script (fresh seed):
#  bad portions -> 400, not persisted | bad override -> 400, not persisted
#  authored item Single 200 / Family 620 + Extra raita 40 -> menu shows it -> order Family+addon payable 660
#  Gachibowli-only item: hidden at outlet 1, order at 1 -> 400, order at 2 -> 201 (WEB-778148)
#  override 319 survives an outlet-list edit | bad PUT -> 400, portions intact
#  empty card -> 400 | card 0000 -> 402, no order | seed orders WEB-778120/778131/778146 intact
#  WEB-778146: Preparing, 15 min late, 2 notifications, all labelled "mock"
#  kitchen role sees Kondapur only | stock toggle on unavailable item -> 404
#  dashboard by outlet: Kondapur 2 orders, Gachibowli 2, Kukatpally 1 (late 1), Banjara Hills 0 (honest zeros)
#  socket: join outlet:1 -> order:created received for a new order, menu:updated received for a stock toggle
#  FSSAI present on all 4 outlets
```

### USER CHECKLIST — explicit verdicts (DONE / MOCK / NOT BUILT)

AI / automation:
- Orders route automatically to the right outlet (area + radius auto-route) — **DONE**. Area picker → haversine distance vs each outlet's radius → nearest in-radius outlet auto-selected; only in-radius outlets offered; outside-radius state is real (e.g. Uppal is ~13 km from the nearest outlet, Banjara Hills, whose radius is 6 km; Secunderabad is likewise outside every radius). Geolocation is an optional shortcut only; manual area pick always works.
- Status updates by WhatsApp/SMS — **MOCK**. One `notifications` row per status change, shown on tracking, labelled "mock WhatsApp/SMS" in the UI. Never claimed as real sending; no provider is called.
- Items pause when an outlet marks them out of stock, live via socket — **DONE**. KDS toggle → `menu:updated` → customer menu refreshes without reload; verified by socket script. Pausing requires the item to be available at that outlet (404 otherwise, v2 fix).
- Reorder suggestions from the customer's own history, never auto-added — **DONE**. "Order again" section lists the customer's past-order items; each needs an explicit Add tap; v2 also blocks adding an out-of-stock/out-of-window suggestion.
- Prep-time estimate from current kitchen load, with breakdown shown — **DONE**. `prep.js`: base (slowest item + 3 min/extra line) + queue load (min(active orders × 4, 30)), shown at checkout and on the KDS.
- When wrong: promised = higher of estimate and outlet minimum — **DONE** (`promised = max(total, outletMinimum)`). 10+ min past promise alerts manager AND updates customer — **DONE** (KDS red manager-alert banner for 10+ min late; customer tracking shows "Running late — we're on it" plus a manager-alert note). Manager can override estimates — **DONE** (manager-only override, 5–240 min, stored on the order and written to the order-history note).

Constraints:
- Every outlet shows its FSSAI licence number — **DONE** (outlet card on menu, checkout drawer, KDS header; all 4 outlets verified). Every item shows veg/non-veg symbol + allergens — **DONE** (symbol with accessible name on every card; allergens tag always shown, including "None", v2 fix). Prices state "include 5% GST" with breakdown — **DONE** (menu hero, checkout drawer, footer; GST split shown at checkout; prices stored GST-inclusive).
- DPDP: marketing opt-in unchecked by default, stored, role-based access — **DONE**. Opt-in checkbox unchecked by default at checkout, stored on the user, toggleable in My orders; order updates are transactional and do not depend on it. Roles enforced server-side: kitchen = own outlet only (verified), customer = own orders only, admin = manager only. No real personal data in the repo.
- KDS readable from 2 metres on a cheap tablet — **DONE** as far as CSS can take it: dark background, Inter bold, 44px timers, 32px order numbers, 20px item lines, 52px stage buttons, late in red AND in words ("LATE by N min", "READY — for pickup"), one column ≤900px so portrait tablets are not cramped. Not verified on a physical tablet (see remaining gaps).
- Peak 1,200 orders/hour — **NOT CLAIMED, correctly limited**. README, TDD outline, deployment guide and this file all state SQLite + single Node instance is a demo, not peak architecture; Postgres + Redis pub/sub + stateless instances is the documented next step. No load test at 1,200/hour was run and none is claimed.

Design / success:
- Minimal design, white space, restrained palette, clear type; big menu photos, scannable prices, checkout designed under a minute — **DONE as design intent**. Off-white #FAFAF8, 1px borders, black primary buttons, Instrument Serif for display headings only + Inter for everything else, no gradients/heavy shadows. Checkout is a single drawer with a "under 60 seconds" target note — this is a design target, not a measured result (no timing study was run, and none is claimed).
- Dashboard measures what it can (orders, prep time, repeat customers by outlet) — **DONE**. Dashboard computes orders, revenue, median prep (Placed→Ready), late count, cancellations and repeat customers per outlet from the live orders table; Banjara Hills correctly shows zeros. The brief's 9-month targets (direct = 12% of app orders; 35% repeat within a month by month 6) are **NOT claimed as achieved** — they are future targets the dashboard helps track, and no figure in the app pretends otherwise.

Out of scope — confirmed NOT built and stated as such in README, TDD outline and deployment guide:
- Delivery-app integration — **NOT BUILT**. Own rider app — **NOT BUILT** (rider handoff is a kitchen stage, not an app). Replacing outlet billing/inventory — **NOT BUILT**. Real payment gateway — **NOT BUILT** (TEST MODE mock only). Real WhatsApp/SMS — **NOT BUILT** (mock log only).

### Remaining gaps (honest, not hidden)

- No live-browser / real-device visual check was possible from this agent (no browser tooling in this environment); layout conclusions are from the built CSS/JSX against the named viewports, not screenshots. A real phone/tablet pass is still recommended before submission.
- Admin-form labels are visually adjacent but not all programmatically associated (customer flows were fixed in v2; the manager CMS form was not fully converted).
- Font fallbacks already existed (`Georgia, serif` / `system-ui, sans-serif`) and degrade gracefully if Google Fonts is blocked; this was verified in the CSS, not by blocking fonts in a browser.
- Unsplash photos need internet; offline they hide gracefully and names/prices remain usable (v1 behaviour, unchanged).

## v3 — QA audit fixes + visual redesign (headless-Chromium verified)

### QA P0 — all fixed, with evidence

| # | Issue | Fix | Evidence |
|---|---|---|---|
| Q0-1 | Production CORS: server allowed only `localhost:5173`, so on Render (where `FRONTEND_URL` is unset by design) the Socket.io handshake could be rejected, killing live KDS/tracking. | `corsOrigin`: strict allowlist when `FRONTEND_URL` is set; same-origin reflection when unset. Docs updated to match (deployment.md, render.yaml comment). No live Render deployment was run, so this is verified by logic + curl, not claimed as a Render run. | curl with `Origin: https://dum-house.onrender.com` → `Access-Control-Allow-Origin` echoed on `/api/health` and on the Socket.io polling handshake. |
| Q0-2 | Checkout had no delivery address; orders table had no address column. | `orders.delivery_address` migration + required-at-checkout validation (400 without it) + pre-filled with the delivery area + editable textarea + shown on tracking (OrderDetail) and on the KDS card. | API: no address → 400; with address → 201, tracking and KDS both return the address verbatim. |
| Q0-3 | Manager Kitchen tab rendered dark KDS inset in a light page with light topbar/footer. | Manager `view==='kitchen'` now returns `<Kitchen>` as root (same as kitchen role) with a "Back to Admin" button. | Headless Chromium, manager login: dark root true, light topbar absent, Back button present; clicking it lands on `#admin` with the admin heading. |
| Q0-4 | Cart not repriced on menu refresh: stale totals and paused items stayed in the cart. | On every menu refresh the cart is repriced from the fresh menu and paused/unavailable items are dropped WITH a visible banner (in the menu view and in the drawer), never silently. | Code + menu-refresh effect; server still recomputes totals as the authority. |

### QA P1 — all fixed

- KDS late/alert now derived client-side from `promised_at` + the 15s tick, not only from the server value at fetch.
- Kitchen socket cleanup uses a named `onConnect` handler; the old bare `s.off('connect')` (which stripped App's menu-reload handler on the shared socket) is gone.
- Managers no longer see a working Add path: menu Add is disabled ("Customer ordering only") for managers, the sticky cart was already hidden for managers, and checkout now rejects non-customer roles server-side in spirit (client guard + server `requireRole('customer')` on order creation).
- Checkout marketing opt-in now initialises from `user.marketing_opt_in` instead of always false (which silently unsubscribed returning customers).
- Dashboard window changed from "today" to the last 7 days (server + client labels): seed orders no longer vanish on day 2, and the UTC/IST "today" boundary no longer flips the numbers at midnight. Late orders are still computed across all active orders.
- Outside-radius now renders a disabled select ("No outlet delivers to this area yet") instead of no outlet control at all; the permission-denied geo note is dismissible.
- Non-veg symbol is now a triangle (clip-path) in a brown square, not a brown circle — colour is no longer the only distinction (FSSAI convention).
- Duplicate Unsplash photos: Butter Naan, Haleem+Biryani Combo, Gulab Jamun, Qubani ka Meetha and Masala Coke/Soda each got a distinct photo URL. (New IDs are Unsplash photo IDs; if any fails, the menu-card fallback and hero fallback below cover it gracefully.)
- Admin: loading state ("Loading dashboard…"), Edit scrolls the form into view, Err Retry button is `type="button"` (it previously would have submitted a surrounding form).
- Tracking timeline for Cancelled orders shows no stage as done (previously Placed showed as done).
- Reorder suggestions: filtered to the current outlet's menu, shown at today's price (not the stale past-order price), moved BELOW the menu (never above the picker), and `alert()` replaced with a dismissible inline banner.
- KDS item lines are 25px at ≥900px widths (20px below), timer stays 44px.
- Mobile nits: sticky-cart button 44px, suggestion Add uses the 44px small-button rule, admin portion/add-on rows stack below 640px, main bottom padding is 88px so the last menu card is never hidden under the sticky bar.

### Visual redesign (user screenshots) — what changed per screen

- **Top nav:** mobile = logo left, Cart right, hamburger only — desktop nav and sign-in/out live in the hamburger panel on phones; no horizontal scroll. Laptop = generous spacing (20px gaps, 16px nav gaps). User badge is now a pill ("Demo · 240 pts", full name on hover/title) that never truncates mid-word; the full name appears in the mobile panel.
- **Page flow:** hero → area/outlet picker → search → pills → menu grid → "Order again" below the menu. Suggestions no longer appear before the user has picked where they are ordering from.
- **Picker:** compact card — area select full-width, "Use my location" beside it on laptop / stacked on mobile, outlet shown as name + "~X km away" badge + "Delivers within Y km" badge with a short-name "Change outlet" select (no long wrapping option text), address on one line, FSSAI as one small muted line.
- **Search + pills:** search is full-width on its own row ("Search dishes"); pills are a single non-wrapping, horizontally scrollable row with a fade edge.
- **Menu cards:** uniform height per row (flex column, footer pinned with `margin-top:auto`, fixed 4:3 photo ratio, description clamped to 2 lines, name min-height). Add-ons collapse behind a "Customise" toggle so default heights are consistent. Time-window items show ONE signal: a badge on the photo plus a disabled button reading "Available at dinner/lunch" (no duplicate pill + grey box). Out-of-stock gets the same treatment. Veg triangle (above). Photo failure shows a designed serif-name placeholder, not a blank gap.
- **Cart drawer:** mobile = true 100vw full-screen sheet (verified: width == viewport, left 0, no page sliver); laptop = 440px drawer. Coupon placeholder is "Coupon code" with the example codes as hint text below. Cart lines show a line total, a clean portion/add-on line (no leading "·" when there is no portion), a 44px stepper row and a Remove text link. The Pay/Sign-in button lives in a sticky drawer footer that is never covered by scrolling content. GST split, loyalty, promised-time breakdown, TEST PAYMENT label and opt-in text are unchanged in content, spaced consistently.
- **Hero:** the serif headline is kept, subtext is darker (muted grey darkened from #6B6B6B to #4A4A4A for small-body contrast), and a large food-photo band sits under the headline. If the photo cannot load, a dark serif fallback band renders instead of empty space.
- **Design system:** 8px spacing scale, 48px primary buttons / 44px small buttons, 48px inputs, 16px menu-card radius / 12px inner cards, near-black body text, placeholders in visible grey (#737373).

### Rendered verification (headless Chromium, local production server)

Chromium was installed in /tmp for this pass (the sandbox browser has no
direct internet, so Unsplash images fail there and fallbacks render — the
URLs themselves return HTTP 200 via curl, so real browsers load the photos).

```
viewports 360 / 390 / 1024 / 1440:
  body horizontal overflow: 0 at every viewport (pill row scrolls by design)
  topbar: every visible button inside the viewport at every width
  search: full-width on its own row, placeholder "Search dishes"
  menu cards: 18 cards, heights equal within each row at 1024/1440 (e.g. 639/639, 640/640)
  pill row: nowrap, scrollable on mobile (716px content in 320–350px)
  mobile: hamburger panel opens; sticky cart full viewport width; drawer width == viewport, left 0
  coupon placeholder: "Coupon code"
KDS (kitchen login, 1024px): dark root, timer 44px, item lines 25px
Manager KDS: dark root, no light topbar, "Back to Admin" -> #admin
Hero fallback (offline): renders at 200px (mobile) with the serif line, not empty space
Screenshots inspected (in /tmp, not in the repo): mobile 390 top (nav, hero, fallback band, picker)
  and laptop 1440 top (nav spacing, hero, picker row) — both clean, no crowding, no truncation.
```

### Demo path re-walked (fresh DB, after redesign)

Customer order WEB-778147 (Family biryani + Extra raita, payable ₹949,
delivery address stored) → kitchen stages Preparing → Ready → Rider
handoff → Handed over (all 200) → tracking shows Handed over with a full
audit trail (Placed → Preparing → Ready → Rider handoff → Handed over)
and 5 mock notification rows. Socket auth: an unauthenticated socket
joining an order room received nothing when the order moved; the owning
customer's authenticated socket received the update.

### P2 — done vs remaining

Done (cheap): hash routing (#menu/#track/#party/#admin/#kitchen/#login),
Escape closes the cart drawer, favicon (inline SVG "D"), card-shaped
menu skeletons, party form draft persisted + return-to-party after
sign-in (no more sign-in trap), lunch/dinner gap banner (16:00–18:00),
estimate now counts quantity (2 min per extra unit, new test),
photo-failure placeholders (menu + hero), loyalty sub-₹50 edge is
already handled by the cap in pricing (discount is a multiple of ₹50,
capped at the amount left — no change needed).
Remaining polish (listed, not hidden): focus trap inside the cart drawer
(Escape works, tab trap does not yet), full `htmlFor` coverage on the
manager CMS form (customer flows are covered), and a real-device
phone/tablet pass (this pass used headless Chromium viewports only).

### Security note (QA flag, now handled + documented)

Socket rooms were unauthenticated in v1/v2: order-room joins now require
a JWT for that order's customer, its outlet's kitchen staff, or a
manager (verified above). Outlet rooms carry only public menu data
(`menu:updated`). Remaining demo limit: JWTs are bearer tokens in
localStorage (standard for a demo, not a production auth design) — this
is stated in the TDD outline, not presented as production-grade.

## v4 — professional auth, Zomato-style interaction, tracking redesign, screenshot loop

Method: headless Playwright Chromium (chromium-1248) against a production
build on a fresh seeded DB (ports 4211/4212, DATA_DIR in /tmp). Screenshots
live in `hidden_files/screenshots-v4/` (c2 = 55, c3 = 55, c4 = 7) and are
NOT committed — they are listed here by filename only so they do not
bloat the submission. The screenshot tooling itself lives in
`hidden_files/tools/` (shot.js, shot4.js, playwright-core install).

### Screenshot cycles — and a harness bug that is NOT an app bug

- Cycle 1 was discarded: it navigated by hash without reloading, so login
  shots showed the logged-out menu. Do not cite c1.
- Cycle 2 (55 shots) mostly showed the Login page for logged-in views.
  Root cause was the harness, not the app: the token was injected into
  localStorage AFTER the app had already booted with no token, so the
  (correct) protected-route guard redirected to login. The same race was
  then found in the app itself (see V4-6) and fixed. Cycle 2 login shots
  themselves are valid (clean login card, demo-account chips).
- Cycle 3 (55 shots, fixed harness: token injected via `addInitScript`
  before the app boots) shows the real views. Cycle 4 (7 shots) re-checks
  the screens changed after cycle 3.
- Real-UI login was also verified by driving the actual form in the
  browser (fill email/password, click the form's Sign in button): login
  200, redirect to menu, header pill "Demo · customer · 240 pts", Sign out
  visible, then #track renders the order cards. (An earlier test attempt
  clicked the header's Sign in button instead of the form's — a test
  selector mistake, not an app failure.)

### Auth (professional, company-style) — verified

- Login: clean card, brand, clear labels, Show/Hide password, friendly
  client validation (empty name, bad email format, password < 8 chars,
  confirm mismatch) before any API call; server errors via banner ("Wrong
  email or password.", "Session expired. Please sign in again."), never
  raw/blank. Demo helper lists all three demo logins as tap-to-fill chips
  with the password note, plus "Staff accounts are created by Dum House —
  sign-up here creates a customer account only."
- Signup: customer registration (name, email, password min 8, confirm)
  creates a customer account only — server `POST /api/auth/register`
  hard-codes role `customer`, bcrypt-hashed, JWT 12h — logs the user in
  and persists. Staff roles are seeded only, not self-registerable.
  Verified: new signup → role customer; duplicate email → 400.
- Protected routes: guard waits for `authChecked` so first paint never
  bounces a signed-in user. Unauthenticated #track/#admin/#kitchen
  redirect to login with a clear message and `dh_after_login` saved, so
  after login the user returns to the requested view if their role allows
  it (manager → Admin, others → Menu). Wrong-role users get a helpful
  access card ("Admin is for managers only…"), never a bare 403.
  API enforcement matches: customer → admin dashboard = 403.
- Session: token in localStorage (`dh_token`), sign-out in desktop nav,
  mobile panel and KDS; `api.js` dispatches `dh:session-expired` on 401
  only when a token was presented; the listener clears token/user, shows
  "Session expired, please sign in again." and routes to login.
  Expired/invalid token screenshot (`login-expired-mobile390.png`) shows
  the login page with the session message, not a broken page.
- Header pill: name + role + points, full text in `title`, never
  truncated mid-word (nav flexes; role+points hidden ≤900px, first name
  stays on mobile, full name/role/points in the mobile panel). Footer on
  customer/admin pages: FSSAI note, "Prices include 5% GST", test-payment
  note. KDS intentionally has no footer (dark kitchen theme).
- Pasted `#track`/`#admin` links and browser Back/Forward now change the
  view (hashchange listener added — previously only in-app clicks did).

### Zomato-style interaction — what changed (fonts/colours unchanged)

Converted to chips/cards/steppers/segmented:
- Outlet picking (menu picker + party): selectable outlet cards (name,
  distance badge, radius, FSSAI small, black border + "✓ Selected").
- Menu portions (≤3): chips (label · price); >3 portions keep a select
  (no current item exceeds 3, so the select is a fallback only).
- Add-ons: clean rows (checkbox, name left, price right) in the
  Customise expansion.
- Payment: proper segmented UPI/Card control (selected = black).
- Veg only: toggle switch (`aria-pressed`) instead of a plain pill.
- Loyalty (checkout, points ≥ 100): toggle-switch row.
- Party guests: stepper (−/+ in steps of 10, clamped 10–500) + quick
  chips 10/20/50/100+.
- Party date/time: date chips for the next 7 valid days (earliest = first
  day ≥48h out, with the 48h note) + time slot chips (12:00 PM, 1:00 PM,
  6:00 PM, 7:00 PM, 8:00 PM, 9:00 PM); the real datetime is derived
  underneath for the API. Saved dates older than the window clamp to the
  first valid day on load.
- Party phone: +91 prefix inside the input, grouped with Name under a
  "Contact" section, inline 10-digit validation under the field.
- Party sections: Contact / Party details / When / Notes; Notes label
  shortened to "Notes" with "Menu preferences, veg count, venue" as hint
  below (fixes the truncated "Notes (menu preferences, veg count, venu e)").
- Admin outlet availability: toggle chips (black + ✓ when selected).
- KDS manager override: quick chips +15/+30/+45/+60 min plus custom input.
- Admin CMS form: Spice / Menu tag / Type are now chips (this pass).
- KDS manager outlet: outlet chips (selected = white) instead of a
  select (this pass).
- Nav truncation (the reported bug: logo cut to "use", pill cut on the
  right): nav now flexes (`flex:1; min-width:0`, brand `flex-shrink:0`,
  pill-rest hidden ≤900px). Re-checked at 1024px
  (`menu-top-laptop1024.png`): "Dum House | Order | My orders | Party
  orders | Demo · customer · 240 pts | Sign out | Cart" — nothing cut.
- The grey "ABC" floating widget in the user's Party screenshot is NOT
  an app element (no such element in App.jsx/styles.css); it is the
  user's screenshot-tool overlay. Noted, not chased in code.

Deliberately left as inputs (with why):
- Area dropdown (12 areas — a long list, the one place a dropdown is
  justified); outside-radius disabled select (a status message, not a
  picker); coupon code, delivery address, CMS names/prices/descriptions/
  allergens/photo URLs, per-outlet override prices, KDS custom minutes
  (free text/numeric by nature); dashboard period (fixed last-7-days
  window from the server — a period chip would lie without an API
  change; the window is labelled explicitly); marketing opt-in checkboxes
  (binary consent, a checkbox is the correct pattern).

### Tracking / My orders redesign — per complaint, verified by screenshot

1. Order selector pills → order list cards: outlet, date/time, order
   number, items summary (first 2 + "+N more"), total, status badge
   (Preparing black / Ready green / Handed over grey / Cancelled red).
2. Timeline → vertical timeline with dots: done stages filled black with
   ✓, current stage ringed with "· Now", future stages grey, stage times
   from events where recorded. (`track-mobile390.png`, `track-laptop1440.png`.)
3. Times → customer headline first: "Delivered at 3:11 am" (from the
   Handed over event), "Ready for pickup", "Arriving in ~X min · Promised
   by …", or "Running late by X min". Prep formula moved to a collapsible
   "How we estimated this".
4. Order history empty dashes — root cause found and fixed: seed
   `order_events` rows were inserted without `to_status`, and the client
   rendered only `e.to_status`. Two-layer fix: client maps
   `e.to_status || e.status` to a human sentence (Placed→"Order placed",
   Preparing→"Kitchen started preparing", Ready→"Ready for pickup",
   Rider handoff→"Rider picked up your order", Handed over→"Order handed
   over", Cancelled→"Order cancelled"); server `orderWithItems`
   normalises events the same way; seed now inserts `to_status` on every
   event. Rows with no human label are not rendered as empty dashes.
   Verified: a fresh order walked through all 5 stages shows all 5 events
   with labels, and 5 notifications (one per stage change, creation
   included).
5. Items → thumbnail photo per item (server joins `items.photo` onto
   order items; client renders a 64px thumb with an initial-letter
   fallback — see V4-7), name + portion (omitted entirely when empty, no
   dangling "·"), add-ons, quantity, line total.
6. Notifications → one "Updates" timeline with a single small demo note
   ("in this demo, order updates are shown here. Real WhatsApp/SMS
   sending is mocked, not actually sent.") instead of "mock" repeated per
   row. Notifications and events are the same stage changes, so showing
   both would duplicate every row; the server already creates a
   notification on every status PATCH and on order creation (the only gap
   was the seed Handed-over order missing a Ready notification — seed
   now inserts it).
7. Points → seed orders now store `floor(payable/20)` (verified:
   WEB-778120 → 59, WEB-778131 → 32, WEB-778146 → 52). Bill shows
   earned/used lines only when > 0, otherwise one explanatory line.
8. Structure → Order card → "Where is your order?" timeline → "Your
   items" → "Bill" → "Updates" → "Loyalty points" → "My party enquiries".
   Log-style headers ("NOTIFICATIONS SENT (MOCK…)", "ORDER HISTORY") are
   gone.

### v4 fixes found by the screenshot loop

| # | Screen / viewport | Issue | Fix | Re-checked |
|---|---|---|---|---|
| V4-1 | Menu card, Customise open, laptop 1440 | "Hide add-ons" button rendered black-on-black on hover: `.btn:hover` set black background, but `.btn-sec:hover` only changed the border, so a secondary button hovered became black bg + black text. This affected every secondary button on hover (Customise, Show, Sign out, Create account). | `.btn-sec:hover` now also sets `background:#fff`; `.btn-danger:hover` likewise (same latent bug). | `customise-hover-laptop1440.png` (c4, mouse deliberately hovered): white button, black "Hide add-ons" text, readable. |
| V4-2 | Order items, all | A photo URL that failed to load (offline/blocked host) was hidden with no replacement, leaving bare text rows. | New `ItemThumb` component: failed photo → initial-letter tile, same as the no-photo case. | `track-mobile390.png` (c4, Unsplash blocked in harness): "C" tiles beside Chicken Dum Biryani and Chicken 65. With internet, real photos load. |
| V4-3 | Menu, nav at 1024px | Previously truncated logo and user pill (user report). | Nav flex fix (above) + pill-rest hidden ≤900px. | `menu-top-laptop1024.png`: full nav, no truncation. |
| V4-4 | Party, mobile 390 + laptop 1440 | Generic form (datetime input, number box, dropdowns, truncated Notes label). | Full Zomato conversion above. | `party-mobile390.png` (c3) + `party-laptop1440.png` (c4, full page): Contact, outlet cards, stepper + chips, date/time chips with "Selected: Fri, 6 Nov · 7:00 PM", Notes hint below, Submit button, footer. |
| V4-5 | Cart drawer, mobile 390 | (Re-checked, no fix needed.) | — | `cart-mobile390.png`: full-screen sheet, coupon + hint, loyalty toggle (240 pts = ₹100 off), pre-filled delivery address, totals, Pay button, nothing covered. |
| V4-6 | Auth, all (race) | A stale in-flight `loadMe` (started before sign-in, e.g. on a slow network) called `setToken(null)` unconditionally in its catch, wiping a newer token that arrived while it was pending. Found via the screenshot harness race, then confirmed as a real (if rare) product race. | `loadMe` captures the token it started with and only clears it if the token has not changed since. | Code + UI-login test after the fix: login 200 → menu, pill shown, #track renders. Tests still 25/25. |
| V4-7 | KDS manager, laptop 1440 | Outlet picker was a generic dropdown in the dark theme. | Outlet chips (this pass). | `kds-manager-1440.png` (c4): Kondapur white/selected, other outlets dark chips, Back to Admin, Refresh, Sign out, order card, override chips, pause chips — all readable. |
| V4-8 | Admin CMS edit, laptop 1440 | Spice / Menu tag / Type were generic dropdowns. | Chips (this pass). | `admin-cms-edit-laptop1440.png` (c4): edit form with chip groups, portion/add-on editors, outlet toggle chips and override prices. |

### v4 full-flow re-walk (fresh DB, port 4212, after the last fix)

```
signup (new customer) -> role customer, token issued; duplicate email -> 400
order WEB-778147 (Single, UPI, address stored) -> payable 299, points earned 14
KDS stages Preparing -> Ready -> Rider handoff -> Handed over (all 200)
tracking: events Placed > Preparing > Ready > Rider handoff > Handed over,
  5 notifications, item photo present
party enquiry -> manager Confirm with manager_note "See you then"
dashboard (last 7 days): 6 orders, revenue 4444, by-outlet breakdown present
customer -> admin dashboard API -> 403
UI login in browser -> menu + pill + #track cards (see above)
npm --prefix server test -> 25 pass, 0 fail; npm run build -> vite build OK
```

### v4 remaining gaps (honest, not hidden)

- No physical phone/tablet check; layout verified in headless Chromium
  viewports only (390/360/768/1024/1440, KDS 1024×768).
- No focus trap in the cart drawer (Escape closes it) — carried from v3.
- Timeline stage times: seed orders record times only for the stages
  that have event rows, so on a Handed-over seed order the Preparing and
  Rider handoff dots show no time (name only, stage still marked done).
  Live orders walked through the KDS record every stage, so this affects
  seed history display only, not live tracking.
- Updates section shows the events that were actually recorded (3 rows
  for a seed Handed-over order whose intermediate stages were seeded
  without notifications); live orders get one notification per stage
  change. This is seed history, not a creation gap — the server creates a
  notification on every status PATCH.
- No live deployment and no GitHub URL were created by the builder.
