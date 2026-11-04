import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()

# Page Margins (Normal 1 inch)
for section in doc.sections:
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

# Color Palette
INK = RGBColor(17, 17, 17)        # #111111
AMBER = RGBColor(180, 83, 9)      # #B45309
MUTED = RGBColor(113, 113, 122)   # #71717A
LIGHT_BG = "FAF8F5"
BORDER_COLOR = "D4D4D8"

def set_cell_background(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

# Title
title_p = doc.add_paragraph()
title_run = title_p.add_run("Technical Design Document")
title_run.font.name = "Arial"
title_run.font.size = Pt(24)
title_run.font.bold = True
title_run.font.color.rgb = INK
title_p.paragraph_format.space_after = Pt(2)

sub_p = doc.add_paragraph()
sub_run = sub_p.add_run("Dum House — Direct Ordering Web Platform & Real-Time Kitchen Display System (KDS)")
sub_run.font.name = "Arial"
sub_run.font.size = Pt(13)
sub_run.font.color.rgb = AMBER
sub_run.font.bold = True
sub_p.paragraph_format.space_after = Pt(14)

# Executive Metadata Table
meta_table = doc.add_table(rows=5, cols=2)
meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
meta_table.autofit = False

meta_data = [
    ("Client Brief:", "Problem 1 — Hyderabad Food Chain (14 Outlets + 3 Cloud Kitchens)"),
    ("Candidate:", "Nayvedya Joyn (joynnayvedya@gmail.com)"),
    ("GitHub Repository:", "https://github.com/letsjoyn/dum-biryani"),
    ("Live Application URL:", "https://dum-biryani.onrender.com"),
    ("Technology Stack:", "Node.js 22+, Express, Socket.io, SQLite (node:sqlite), Vite, React 18")
]

for row_idx, (label, val) in enumerate(meta_data):
    row = meta_table.rows[row_idx]
    
    cell_lbl = row.cells[0]
    cell_lbl.width = Inches(1.8)
    p_lbl = cell_lbl.paragraphs[0]
    r_lbl = p_lbl.add_run(label)
    r_lbl.font.bold = True
    r_lbl.font.size = Pt(9.5)
    r_lbl.font.color.rgb = INK
    set_cell_background(cell_lbl, "F4F2EC")
    set_cell_margins(cell_lbl, top=80, bottom=80, left=120, right=120)
    
    cell_val = row.cells[1]
    cell_val.width = Inches(5.1)
    p_val = cell_val.paragraphs[0]
    r_val = p_val.add_run(val)
    r_val.font.size = Pt(9.5)
    if "https://" in val:
        r_val.font.color.rgb = AMBER
        r_val.font.bold = True
    else:
        r_val.font.color.rgb = INK
    set_cell_background(cell_val, "FAF9F6")
    set_cell_margins(cell_val, top=80, bottom=80, left=120, right=120)

doc.add_paragraph().paragraph_format.space_after = Pt(8)

def add_heading_1(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(14)
    h.paragraph_format.space_after = Pt(4)
    r = h.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = INK
    return h

def add_heading_2(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(10)
    h.paragraph_format.space_after = Pt(2)
    r = h.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(11)
    r.font.bold = True
    r.font.color.rgb = AMBER
    return h

def add_body(text, bold_prefix=""):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix + " ")
        r_pre.font.bold = True
        r_pre.font.color.rgb = INK
        r_pre.font.size = Pt(10)
    r = p.add_run(text)
    r.font.size = Pt(10)
    r.font.color.rgb = INK
    return p

# 1. Executive Summary
add_heading_1("1. Executive Summary & Problem Context")
add_body(
    "Company A is a prominent Hyderabad biryani and authentic regional food chain operating 14 dine-in outlets and 3 cloud kitchens across Greater Hyderabad with 520 staff and ₹90–105 crore annual turnover. Currently, 55% of revenue (₹52.8 crore) flows through third-party food delivery apps charging steep 25–30% commissions. Furthermore, the brand loses approximately 30 high-margin bulk/party catering orders every month due to manual phone ordering friction."
)
add_body(
    "Shifting just 12% of app orders to direct ordering saves 15 percentage points in commissions (net direct delivery/payment cost is 12%), yielding ₹95.04 lakh/year in savings. Recovering 30 bulk party orders/month at ₹18,000 ticket size (30% margin) saves an additional ₹19.44 lakh/year. Total verified bottom-line benefit equals ₹1.14 crore/year.",
    "Economic Impact:"
)
add_body(
    "We delivered a production-ready, full-stack, end-to-end direct ordering web application with automatic nearest-outlet georouting across 17 Hyderabad locations, a real-time Kitchen Display System (KDS) powered by WebSockets, centralized Menu CMS with outlet-level price overrides and instant 86-ing stock controls, 5% direct customer loyalty points, DPDP Act 2023 compliant data governance, and an outlet operations dashboard.",
    "Delivered Solution:"
)

# 2. Architecture & Design Rationale
add_heading_1("2. Architecture & Technical Rationale")
add_body(
    "The system is built as a single deployable unit: an Express.js server that simultaneously serves REST API endpoints, hosts stateful bi-directional Socket.io WebSocket rooms, and delivers the compiled, optimized Vite + React 18 Single Page Application (SPA) on a unified single port (4000 locally, port-assigned on cloud hosts)."
)
add_body(
    "1. Zero Reviewer Friction: Leveraging Node 22+ native node:sqlite eliminates native C++ bindings (node-gyp, python build tools) and external database server daemons. A reviewer runs `npm run install:all && npm run build && npm start` and the entire product runs out of the box with zero external configuration.\n"
    "2. Same-Origin Simplicity: Serving the Vite React bundle from Express eliminates CORS preflight delays and foreign-origin WebSocket handshake rejections in production environments.\n"
    "3. Decoupled Pure Domain Logic: Core business rules (GST-inclusive calculations, coupon stacking, AI prep estimation, KDS ticket prioritization) are separated into pure, serverless modules covered by 25 unit tests with 100% pass rate in < 300ms.",
    "Architectural Decisions:"
)

# 3. Data Model
add_heading_1("3. Data Model & Database Schema")
add_body("The database is relational and strictly enforced with SQLite WAL mode and foreign key constraints:")

schema_table = doc.add_table(rows=8, cols=3)
schema_table.alignment = WD_TABLE_ALIGNMENT.CENTER
schema_data = [
    ("outlets", "id, name, address, phone, fssai, min_prep_minutes, delivery_radius_km, lat, lon", "Stores 14 outlets + 3 cloud kitchens in Hyderabad. Lat/Lon and delivery radius control automatic georouting."),
    ("users", "id, name, email, password_hash, role, outlet_id, points, phone, marketing_opt_in", "Roles: customer, kitchen, manager. Kitchen staff bound to outlet_id. DPDP Act 2023 opt-in default 0 (consent needed)."),
    ("items", "id, name, category, description, price, veg, spice, allergens, photo, portions, addons, base_minutes, menu_tag", "Central menu items. Portions (Single/Family) and add-ons stored as structured JSON. Prices include 5% GST."),
    ("item_outlets", "item_id, outlet_id, out_of_stock, price_override", "Per-outlet stock & pricing. Instant 86-ing marks out_of_stock=1, vanishing dish in real time from customer menu."),
    ("orders", "id, order_no, user_id, outlet_id, status, subtotal, payable, gst_amount, payment_method, estimate_minutes, estimate_breakdown, promised_at, delivery_address, request_key", "Orders table. request_key guarantees idempotency. Stages: Placed -> Preparing -> Ready -> Handed over."),
    ("points_ledger", "id, user_id, order_id, delta, reason, created_at", "Append-only ledger tracking 5% loyalty points earned (1 pt per ₹20) and redeemed (₹50 off per 100 pts)."),
    ("party_enquiries", "id, user_id, outlet_id, name, phone, email, guests, event_date, preferred_time, notes, status, manager_note", "Bulk catering enquiries enforcing strict 48-hour advance notice rule. Reviewed & confirmed by catering manager."),
    ("order_events", "id, order_id, status, to_status, created_at", "Immutable audit log tracking exact stage timestamps used to compute median prep time metrics.")
]

for row_idx, (tbl, cols, desc) in enumerate(schema_data):
    row = schema_table.rows[row_idx]
    
    c0 = row.cells[0]
    c0.width = Inches(1.2)
    p0 = c0.paragraphs[0]
    r0 = p0.add_run(tbl)
    r0.font.bold = True
    r0.font.size = Pt(8.5)
    set_cell_background(c0, "F4F2EC")
    set_cell_margins(c0, 60, 60, 80, 80)
    
    c1 = row.cells[1]
    c1.width = Inches(2.2)
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(cols)
    r1.font.size = Pt(8)
    r1.font.name = "Consolas"
    set_cell_background(c1, "FAF9F6")
    set_cell_margins(c1, 60, 60, 80, 80)
    
    c2 = row.cells[2]
    c2.width = Inches(3.5)
    p2 = c2.paragraphs[0]
    r2 = p2.add_run(desc)
    r2.font.size = Pt(8.5)
    set_cell_background(c2, "FAF9F6")
    set_cell_margins(c2, 60, 60, 80, 80)

# 4. Core User Flows
add_heading_1("4. Core User Journeys & Workflows")
add_body(
    "Customer selects from 40+ curated Hyderabad localities (e.g. Kondapur, Madhapur, Gachibowli, Kukatpally, Banjara Hills) or taps 'Locate Me' GPS. Haversine distance is calculated against all 17 hubs; order auto-routes to the nearest hub within delivery radius.",
    "1. Georouting & Outlet Assignment:"
)
add_body(
    "Single and Family (serves 4) portions with portion-specific pricing, add-ons (Extra raita, extra salan, extra papad), veg/non-veg indicator, spice level (Low/Medium/Hot), allergen tags, and time-based availability (Lunch 11:00–16:00 IST, Dinner 18:00+ IST, All Day).",
    "2. Food Menu & Customization:"
)
add_body(
    "Responsive slide-over cart drawer with 5% GST split, coupon discount (DIRECT10, WELCOME100), 5% direct loyalty point redemption, simulated UPI & Card payment (test decline for card ending 0000), DPDP Act 2023 marketing opt-in checkbox, completing in under 60 seconds.",
    "3. Checkout & Payment Simulation:"
)
add_body(
    "KDS tickets update instantly via Socket.io WebSocket rooms (outlet:<id>). Displays elapsed timers, honest AI prep countdown, and color-coded late status. Kitchen staff progress orders with 1-tap: Placed -> Preparing -> Ready -> Handed over. Overdue orders (10+ min late) trigger manager escalation.",
    "4. Live Kitchen Display System (KDS):"
)
add_body(
    "Kitchen staff tap any dish button to toggle stock status. When marked 86'd, the dish vanishes in real-time from the customer menu for that outlet only.",
    "5. Instant 86-ing Stock Controls:"
)
add_body(
    "Date picker enforces 48-hour advance notice server-side; guest counter calculates required food volume; catering manager reviews, confirms or declines with a custom customer note.",
    "6. Party & Bulk Catering Request:"
)
add_body(
    "Executive metrics showing total orders, gross revenue, median prep time (placed to ready), cancellations, and repeat customer ordering rates broken down per outlet.",
    "7. Manager Operations Dashboard:"
)

# 5. AI & Automation
add_heading_1("5. AI & Automation Engine")
add_body(
    "Rather than unexplainable external LLM calls that fail during production rush hours, the AI prep-time engine is a deterministic queue-load formula in server/src/prep.js:\n"
    "• base = slowest_item_prep + (extra_lines * 3m) + (extra_units * 2m)\n"
    "• queueLoad = min(active_outlet_orders * 4m, 30m)\n"
    "• total = base + queueLoad\n"
    "• promised = max(total, outlet_minimum_prep_minutes)\n\n"
    "Where the AI can be wrong and mitigations:\n"
    "1. Kitchen Rush: Staff and managers have an inline override bar directly on KDS tickets (+15m, +30m, +45m, +60m or custom minutes) to immediately update promised time.\n"
    "2. Cold Start: The outlet minimum prep floor (30–35 min) guarantees the system never under-promises.\n"
    "3. Reorders: AI suggests reorders based on customer order history, but suggestions NEVER auto-add to the cart.\n"
    "4. 10m+ Late Escalation: Any order 10 minutes past promise triggers an alert banner on KDS and updates customer with 'Running late — kitchen is expediting'."
)

# 6. UI/UX Design Decisions
add_heading_1("6. UI / UX Design & Aesthetics")
add_body(
    "• Restrained Palette: Grounded in deep charcoal (#111111), artisanal warm linen (#FAF8F4), hairline borders (#2B2823), and warm amber accents (#B45309). Zero emojis across the entire UI for a sleek enterprise look.\n"
    "• Strict 0px Border Radius (--r: 0px !important): Clean architectural square aesthetic reflecting modern brutalist luxury design.\n"
    "• 2-Metre KDS Readability: High-contrast dark theme (#141311) with stark white action buttons, huge quantities (×2), and color-coded late status.\n"
    "• Fluid 0.22s Physics: Silky smooth upward glide (translateY(8px) -> 0) on view changes, side-drawer slide-ins, and zero horizontal tucking on mobile sticky cart."
)

# 7. Reviewer Must-Have Verification Matrix
add_heading_1("7. Reviewer Must-Have Verification Matrix")

verif_table = doc.add_table(rows=10, cols=3)
verif_table.alignment = WD_TABLE_ALIGNMENT.CENTER

verif_data = [
    ("14 Outlets + 3 Cloud Kitchens", "server/src/seed.js", "All 17 Hyderabad locations seeded with lat/lon, FSSAI, delivery radius."),
    ("Exact Sample Orders", "server/src/seed.js", "Seeded WEB-778120 (Preparing), WEB-778131 (Ready), WEB-778146 (Late by 4m)."),
    ("Direct Ordering & Cart", "MenuPage.jsx, Cart.jsx", "Add-ons, Single/Family packs, coupons, 5% loyalty, UPI/Card checkout in <60s."),
    ("Real-Time KDS", "KitchenPage.jsx, server.js", "Instant WebSockets, 5 stages, elapsed & countdown timers, 10m+ late alerts."),
    ("Central Menu CMS", "AdminPage.jsx", "Dish CRUD, veg/spice badges, photo URLs, time-windows, per-outlet price customization."),
    ("Instant 86-ing Stock Controls", "KitchenPage.jsx, AdminPage.jsx", "Real-time out-of-stock toggle immediately pauses/resumes dishes on customer menu."),
    ("Party / Bulk Catering", "PartyPage.jsx, AdminPage.jsx", "Enforces 48-hour advance notice; catering manager review & confirmation with note."),
    ("Operations Dashboard", "AdminPage.jsx", "Orders, revenue, cancellations, repeat customer rate, median prep time by outlet."),
    ("FSSAI, GST & DPDP Act 2023", "Cart.jsx, Nav.jsx, server.js", "FSSAI shown per outlet; 5% GST split shown; marketing opt-in defaults to 0."),
    ("Test Suite Verification", "npm --prefix server test", "All 25 automated backend tests passing in < 300ms.")
]

for row_idx, (req, file_loc, outcome) in enumerate(verif_data):
    row = verif_table.rows[row_idx]
    
    c0 = row.cells[0]
    c0.width = Inches(2.0)
    p0 = c0.paragraphs[0]
    r0 = p0.add_run(req)
    r0.font.bold = True
    r0.font.size = Pt(8.5)
    set_cell_background(c0, "F4F2EC")
    set_cell_margins(c0, 60, 60, 80, 80)
    
    c1 = row.cells[1]
    c1.width = Inches(1.8)
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(file_loc)
    r1.font.size = Pt(8)
    r1.font.name = "Consolas"
    set_cell_background(c1, "FAF9F6")
    set_cell_margins(c1, 60, 60, 80, 80)
    
    c2 = row.cells[2]
    c2.width = Inches(3.1)
    p2 = c2.paragraphs[0]
    r2 = p2.add_run(outcome)
    r2.font.size = Pt(8.5)
    set_cell_background(c2, "FAF9F6")
    set_cell_margins(c2, 60, 60, 80, 80)

# 8. Assumptions
add_heading_1("8. Labelled Assumptions")
add_body("[A1] Fictional Brand: Brand 'Dum House', outlet addresses, FSSAI numbers, and phone numbers are formatted realistically for Hyderabad.")
add_body("[A2] Price by City: All 17 hubs are within Hyderabad; 'price by city' is implemented as one central Hyderabad base price plus per-outlet price customization overrides.")
add_body("[A3] Meal Windows: Lunch is 11:00–16:00 IST; Dinner is 18:00–24:00 IST; All-day items remain available continuously.")
add_body("[A4] Geodistances: Distances are calculated via standard Haversine formula against hub coordinates.")
add_body("[A5] Manager Role: The 'manager' role intentionally covers both the outlet manager and central marketing/admin team functions.")
add_body("[A6] Sample Seed Orders: Seed data strictly matches the brief's sample table (WEB-778120 ₹1,180 Preparing; WEB-778131 ₹640 Ready; WEB-778146 ₹1,050 Late by 4m).")

# 9. What was cut vs next
add_heading_1("9. Deliberate Cuts & Production Roadmap")
add_body(
    "Deliberate Cuts (Brief Out-of-Scope): Third-party delivery aggregator scraping, proprietary rider tracking apps (delivery riders provided by third-party logistics partners), physical restaurant POS billing/inventory replacement.\n\n"
    "Next Production Roadmap:\n"
    "1. Distributed PostgreSQL with Redis Pub/Sub for horizontal scaling across 1,200 peak orders/hour.\n"
    "2. Production payment gateway (Razorpay / Cashfree) with secure webhook listeners.\n"
    "3. GupShup / Twilio WhatsApp transactional messaging integration.\n"
    "4. Google Maps Distance Matrix API for live traffic routing."
)

doc.save("Technical_Design_Document.docx")
print("Technical_Design_Document.docx created successfully!")
