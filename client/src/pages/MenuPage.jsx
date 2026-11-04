// MenuPage.jsx — Sleek menu with rich background biryani hero banner
import { useState, useMemo } from 'react';
import MenuCard from '../components/MenuCard.jsx';
import { Err, MenuSkeletons } from '../components/Common.jsx';
import { fmt } from '../api.js';

function isInWindow(tag) {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (tag === 'Lunch') return h >= 11 && h < 16;
  if (tag === 'Dinner') return h >= 18;
  return true;
}

export default function MenuPage({
  user, outlets, outletId, areaName,
  menu, loading, error, loadMenu, cart = [], addToCart, onUpdateQty, suggestions,
  addSuggestion, sugMsg, setSugMsg, cartNotice, setCartNotice,
  onOpenLocationModal,
}) {
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cat, setCat] = useState('All');

  const outlet = outlets.find((o) => o.id === outletId);
  const cats = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))], [menu]);

  const filtered = menu.filter(
    (m) =>
      (!vegOnly || m.veg) &&
      (cat === 'All' || m.category === cat) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase()))
  );

  const visibleSuggestions = suggestions
    .map((s) => {
      const item = menu.find((m) => m.name === s.item_name);
      if (!item) return null;
      const currentPrice = item.portions.length
        ? (item.portions.find((pp) => pp.label === s.portion) || item.portions[0]).price
        : item.price;
      return { ...s, currentPrice };
    })
    .filter(Boolean);

  return (
    <>
      {/* ── Rich Background Hero Banner ── */}
      <section className="hero-banner-bg">
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="eyebrow-light">Hyderabad · Authentic Dum Since Day One</div>
          <h1 className="hero-title">Dum, <i>done right.</i></h1>
          <p className="hero-subtext">
            Authentic Hyderabadi biryani slow-cooked on dum. Ordered direct with honest prep times, zero commission markups, and straight to the kitchen screen.
          </p>
          <div className="hero-badges-row">
            <span className="hero-badge-tag">Prices include 5% GST</span>
            <span className="hero-badge-tag">FSSAI Certified</span>
            <span className="hero-badge-tag">Live Kitchen Tracking</span>
          </div>
        </div>
      </section>

      {/* ── Compact Location & Outlet Bar ── */}
      <div className="outlet-status-bar">
        <div className="outlet-status-info">
          <div className="outlet-title-row">
            <span className="outlet-current-name">{outlet?.name || 'Kondapur'} Outlet</span>
            <span className="outlet-tag">Delivering to {areaName}</span>
          </div>
          <div className="outlet-meta-row">
            <span>FSSAI: {outlet?.fssai || '—'}</span>
            <span>·</span>
            <span>Min prep: {outlet?.min_prep_minutes || 30} mins</span>
            {outlet?.address && <span>·</span>}
            {outlet?.address && <span className="outlet-address-short">{outlet.address}</span>}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sec btn-sm change-loc-btn"
          onClick={onOpenLocationModal}
        >
          Change Outlet / Area
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filters-bar-container">
        <div className="filters-search-wrap">
          <input
            aria-label="Search the menu"
            placeholder="Search biryanis, breads, kebabs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="menu-search-input"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filters-actions-wrap">
          <button
            type="button"
            className={`filter-btn-toggle ${vegOnly ? 'active' : ''}`}
            aria-pressed={vegOnly}
            onClick={() => setVegOnly(!vegOnly)}
          >
            <span className={`toggle-box ${vegOnly ? 'checked' : ''}`} />
            Veg Only
          </button>

          <div className="categories-scroll-list">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                className={`category-filter-btn ${cat === c ? 'active' : ''}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Menu Section ── */}
      <div style={{ marginTop: 20 }}>
        {cartNotice && (
          <div className="banner" style={{ marginBottom: 16 }}>
            {cartNotice}
            <button
              type="button"
              className="btn btn-sec btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => setCartNotice('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {menu.some((m) => !isInWindow(m.menu_tag)) && (
          <div className="banner" style={{ marginBottom: 16 }}>
            Note: Lunch items are served 11:00–16:00 IST; dinner items from 18:00 IST. All-day items are ready now.
          </div>
        )}

        <Err msg={error} retry={loadMenu} />
        {loading ? (
          <MenuSkeletons count={6} />
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <h2 className="serif" style={{ fontSize: 24 }}>No dishes found</h2>
            <p className="muted">No items match your active search or filters.</p>
            <button
              className="btn btn-sec"
              onClick={() => { setSearch(''); setVegOnly(false); setCat('All'); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="menu-grid">
            {filtered.map((m) => (
              <MenuCard
                key={m.id}
                item={m}
                cart={cart}
                onAdd={addToCart}
                onUpdateQty={onUpdateQty}
                canOrder={user?.role !== 'manager'}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Smart Reorder ── */}
      {user?.role === 'customer' && visibleSuggestions.length > 0 && (
        <section className="card reorder-section" style={{ marginTop: 32 }}>
          <div className="eyebrow">Smart Reorder</div>
          <h2 className="serif" style={{ fontSize: 24, margin: '6px 0 4px' }}>From your past orders</h2>
          <p className="small muted" style={{ margin: '0 0 14px' }}>
            Quickly re-add dishes you've enjoyed before at current outlet pricing.
          </p>
          {sugMsg && (
            <div className="banner" style={{ marginBottom: 10 }}>
              {sugMsg}
              <button type="button" className="btn btn-sec btn-sm" style={{ marginLeft: 8 }} onClick={() => setSugMsg('')}>
                Dismiss
              </button>
            </div>
          )}
          <div className="reorder-grid">
            {visibleSuggestions.map((s, i) => (
              <div key={i} className="reorder-card">
                <div>
                  <strong>{s.item_name}</strong>
                  {s.portion && <span className="small muted"> · {s.portion}</span>}
                  <div className="small price" style={{ marginTop: 2 }}>{fmt(s.currentPrice)}</div>
                </div>
                <button className="btn btn-sec btn-sm" onClick={() => addSuggestion(s)}>
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
