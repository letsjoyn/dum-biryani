# Dum House — deployment guide

**Live URL:** _placeholder — fill in after you deploy from your own account.
No live deployment was created by the builder, and no cloud account was
created. The app is designed so one URL serves everything (API + frontend +
websockets, same origin).

## Demo logins (password for all: `Demo123!`)

| Role | Email | Scope |
|---|---|---|
| Customer | `customer@demo.in` | Own orders, loyalty, party enquiries |
| Kitchen | `kitchen@demo.in` | Kondapur outlet only |
| Manager | `manager@demo.in` | Menu CMS, dashboard, party confirmation, overrides |

Role mapping (explicit): `manager` covers both the outlet manager and the
central marketing/admin role from the brief — there is no fourth role in
this demo, by design, so no half-working role is presented as a feature.

## 1. Run it locally (exact steps)

Requirements: Node.js >= 22 (Node 24 verified), npm. No database server,
no native modules, no API keys.

```bash
cd isocode-dum-house
npm run install:all     # installs server/ and client/
npm --prefix server test  # 25 tests — must pass
npm run build           # builds client/ into client/dist/
npm start               # serves API + built frontend on http://localhost:4000
```

For frontend-only development with hot reload (optional):

```bash
# Terminal 1: API on :4000
npm --prefix server start
# Terminal 2: Vite dev server on :5173 (proxies /api + websockets to :4000)
npm --prefix client run dev
```

On first boot the server seeds itself idempotently (4 outlets, 18 items,
3 demo users, 5 orders including the brief's three sample orders, 2 coupons)
if the tables are empty. Deleting the database file re-seeds on next boot.

## 2. Deploy on Render — one service (recommended)

1. Push this repo to GitHub (public, until review is finished).
2. In Render: **New → Web Service → Build and deploy from a Git repository**,
   pick the repo. Render reads `render.yaml` in the repo root:
   - Build: `npm run install:all && npm run build`
   - Start: `npm start`
   - Health check: `/api/health`
   - A 1 GB persistent disk mounted at `/data` so SQLite survives restarts.
3. Render sets `PORT` automatically. `render.yaml` sets `NODE_ENV=production`
   and generates `JWT_SECRET` for you (Render's `generateValue`). `DATA_DIR`
   is `/data`. Do **not** set `FRONTEND_URL` on Render — same-origin serving
   means the browser talks to the same host. The server handles this
   explicitly (v3 fix): when `FRONTEND_URL` is unset it reflects the
   requesting origin (the SPA it serves); when set, only that origin is
   allowed. The old code allowed only `localhost:5173`, which could
   reject the Socket.io handshake on the Render URL and kill live KDS —
   that bug is fixed and verified by curl (foreign Origin →
   `Access-Control-Allow-Origin` echoed) in VERIFICATION.md.
4. Open the service URL. The first request seeds the demo data (a few
   seconds). Sign in with the demo logins above.

Alternative: build and run the included `Dockerfile` (multi-stage: builds
the client, runs the server). Supply `PORT`, `NODE_ENV=production`,
`JWT_SECRET` and a persistent volume mounted at the `DATA_DIR` path:

```bash
docker build -t dum-house .
docker run -p 4000:4000 -e NODE_ENV=production -e JWT_SECRET='<generated-secret>' \
  -e DATA_DIR=/data -v dumhouse-data:/data dum-house
```

## 3. Environment variables (names only — never values)

| Name | Local default | Production |
|---|---|---|
| `PORT` | `4000` | Set by the host (Render sets it automatically) |
| `NODE_ENV` | unset (dev) | `production` — without a `JWT_SECRET` the server refuses to start |
| `JWT_SECRET` | dev-only fallback (never used in production) | **Required** in production; generate a long random secret |
| `DATA_DIR` | `./data` (server) | `/data` on Render (persistent disk) |
| `FRONTEND_URL` | `http://localhost:5173` (dev) | Only needed for a split frontend/backend deploy; leave unset for the single-URL deploy |

Legacy names still honoured: `CLIENT_URL` (same as `FRONTEND_URL`) and
`DB_PATH` (overridden by `DATA_DIR` when set).

## 4. Verify the live deployment (reviewer checklist)

1. Open the live URL → menu loads, Kondapur selected, FSSAI shown.
2. Sign in as `customer@demo.in` / `Demo123!` → add Chicken Dum Biryani
   (Family) → checkout with test UPI → order number appears.
3. In a second tab, sign in as `kitchen@demo.in` / `Demo123!` → the order is
   already on the kitchen display (no refresh), timer ticking.
4. Move it Preparing → Ready for pickup → Rider handoff → Handed over →
   the customer tracking timeline moves live in the first tab.
5. Sign in as `manager@demo.in` / `Demo123!` → Admin → Dashboard shows
   last-7-days orders/revenue by outlet, computed from the database.
6. Try the failure paths: card ending `0000` declines with no order and
   the cart kept; a party date under 48h away is refused.

## 5. Honest limits

- **Scale:** SQLite + a single Node instance is fine for a demo and a
  reviewer walkthrough. It is **not** the architecture for the brief's
  peak of 1,200 orders/hour across outlets. The next step is Postgres +
  Redis pub/sub for Socket.io + horizontally scaled instances — see the
  TDD outline. Do not claim this demo handles that peak.
- **Payments/messages:** test-mode mock only. No real gateway, no real
  WhatsApp/SMS — notification rows are labelled "mock" in the UI.
- **Out of scope (not built):** delivery-app integration, an own rider app,
  replacing outlet billing or inventory — as the brief requires.
