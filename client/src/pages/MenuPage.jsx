// MenuPage.jsx — Sleek menu with compact location switcher and sharp minimal cards
import { useState, useMemo, useEffect } from 'react';
import MenuCard from '../components/MenuCard.jsx';
import { Err, MenuSkeletons } from '../components/Common.jsx';
import { fmt } from '../api.js';

const AREAS = [
  ['Kondapur', 17.461, 78.342], ['Gachibowli', 17.440, 78.350], ['Madhapur', 17.448, 78.389],
  ['HITEC City', 17.443, 78.381], ['Manikonda', 17.420, 78.367], ['Miyapur', 17.496, 78.361],
  ['Kukatpally', 17.484, 78.408], ['Jubilee Hills', 17.432, 78.407], ['Banjara Hills', 17.415, 78.437],
  ['Begumpet', 17.440, 78.460], ['Secunderabad', 17.440, 78.500], ['Uppal', 17.398, 78.558],
];

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371, dLa = (bLat - aLat) * Math.PI / 180, dLo = (bLon - aLon) * Math.PI / 180;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function isInWindow(tag) {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (tag === 'Lunch') return h >= 11 && h < 16;
  if (tag === 'Dinner') return h >= 18;
  return true;
}

export default function MenuPage({
  user, outlets, outletId, setOutletId, areaName, setAreaName,
  menu, loading, error, loadMenu, cart, addToCart, suggestions,
  addSuggestion, sugMsg, setSugMsg, cartNotice, setCartNotice,
  showLocModal, setShowLocModal,
}) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cat, setCat] = useState('All');
  const [geoNote, setGeoNote] = useState('');

  const area = AREAS.find((a) => a[0] === areaName) || AREAS[0];
  const outletsWithDistance = outlets.map((o) => ({
    ...o,
    distanceKm: o.lat && o.lon ? haversineKm(area[1], area[2], o.lat, o.lon) : 0,
  }));
  const inRadius = outletsWithDistance
    .filter((o) => o.distanceKm <= o.delivery_radius_km)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const outsideRadius = outlets.length > 0 && inRadius.length === 0;

  useEffect(() => {
    if (outlets.length === 0) return;
    if (outsideRadius) return;
    if (!inRadius.some((o) => o.id === outletId)) setOutletId(inRadius[0].id);
  }, [areaName, outlets.length]);

  const pickArea = (name) => { setAreaName(name); setGeoNote(''); };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoNote('Geolocation not available in your browser — select an area manually.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ranked = outletsWithDistance
          .map((o) => ({ ...o, d: haversineKm(latitude, longitude, o.lat, o.lon) }))
          .sort((a, b) => a.d - b.d);
        const near = ranked.find((o) => o.d <= o.delivery_radius_km);
        if (!near) {
          setGeoNote(`Outside all delivery zones (nearest: ${ranked[0]?.name} ~${ranked[0]?.d.toFixed(1)} km). Pick an area manually.`);
          return;
        }
        setGeoNote(`Nearest outlet found: ${near.name} (~${near.d.toFixed(1)} km).`);
        setOutletId(near.id);
      },
      () => setGeoNote('Location access denied — pick an area from the list.')
    );
  };

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
      {/* ── Hero ── */}
      <section className="hero">
        <div className="eyebrow">Hyderabad · Since the dum was sealed</div>
        <h1>Dum, <i>done right.</i></h1>
        <p>
          Hyderabadi biryani ordered direct — honest prep time, zero marketplace commission, and straight to the outlet kitchen.
        </p>
        <p className="small muted">All prices include 5% GST · FSSAI licence shown per outlet.</p>
        <div className="hero-photo">
          {heroFailed ? (
            <div className="hero-fallback">
              <span className="serif">Hyderabadi dum biryani, <i>sealed and slow-cooked.</i></span>
            </div>
          ) : (
            <img
              src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1200&q=80&auto=format&fit=crop"
              alt="Chicken dum biryani, sealed and slow-cooked"
              loading="eager"
              decoding="async"
              onError={() => setHeroFailed(true)}
            />
          )}
        </div>
      </section>

      {/* ── Compact Location & Outlet Bar (Replaces bulky "Where are you" card) ── */}
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
          onClick={() => setShowLocModal(true)}
        >
          Change Outlet / Area
        </button>
      </div>

      {/* ── Location Switcher Modal / Overlay ── */}
      {showLocModal && (
        <div className="modal-backdrop" onClick={() => setShowLocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Select Delivery Location</h3>
                <p className="small muted" style={{ margin: '4px 0 0' }}>Orders route automatically to the nearest kitchen.</p>
              </div>
              <button
                type="button"
                className="btn btn-sec btn-sm"
                onClick={() => setShowLocModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <label htmlFor="area-select" style={{ fontSize: 13, fontWeight: 600 }}>Delivery Area (Hyderabad)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select
                  id="area-select"
                  value={areaName}
                  onChange={(e) => pickArea(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {AREAS.map((a) => <option key={a[0]} value={a[0]}>{a[0]}</option>)}
                </select>
                <button
                  type="button"
                  className="btn btn-sec btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={useMyLocation}
                >
                  Locate me
                </button>
              </div>

              {geoNote && (
                <div className="banner info" style={{ marginBottom: 14 }}>
                  {geoNote}
                </div>
              )}

              {outsideRadius ? (
                <div className="banner err">
                  <strong>Outside delivery radius.</strong> No outlet delivers to {area[0]} yet. Please choose another area (e.g. Kondapur, Gachibowli, Kukatpally).
                </div>
              ) : (
                <>
                  <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Select Kitchen Outlet</div>
                  <div className="outlet-selector-grid">
                    {inRadius.map((o) => (
                      <div
                        key={o.id}
                        className={`outlet-select-card ${o.id === outletId ? 'selected' : ''}`}
                        onClick={() => { setOutletId(o.id); setShowLocModal(false); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setOutletId(o.id); setShowLocModal(false); } }}
                      >
                        <div className="row">
                          <strong>{o.name}</strong>
                          {o.id === outletId && <span className="badge-selected">Selected</span>}
                        </div>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          ~{o.distanceKm.toFixed(1)} km away · Delivery within {o.delivery_radius_km} km
                        </div>
                        <div className="small muted">FSSAI: {o.fssai}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-sec btn-full"
                onClick={() => setShowLocModal(false)}
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Filter Bar ── */}
      {!outsideRadius && (
        <div className="filters-bar-container">
          <div className="filters-search-wrap">
            <input
              aria-label="Search the menu"
              placeholder="Search dishes by name or description…"
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
      )}

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
            Note: Some items are served only during Lunch (11:00-16:00) or Dinner (18:00+). All-day items are available immediately.
          </div>
        )}

        {outsideRadius ? (
          <div className="card empty-state">
            <h2 className="serif" style={{ fontSize: 26 }}>No delivery available here yet.</h2>
            <p className="muted">Please switch your delivery area to Kondapur, Gachibowli, Kukatpally, or Banjara Hills.</p>
            <button className="btn btn-sec" onClick={() => setShowLocModal(true)}>
              Change Area
            </button>
          </div>
        ) : (
          <>
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
                    onAdd={addToCart}
                    canOrder={user?.role !== 'manager'}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Order Again (Reorder Suggestions) ── */}
      {user?.role === 'customer' && visibleSuggestions.length > 0 && (
        <section className="card reorder-section" style={{ marginTop: 32 }}>
          <div className="eyebrow">Smart Reorder</div>
          <h2 className="serif" style={{ fontSize: 24, margin: '6px 0 4px' }}>From your past orders</h2>
          <p className="small muted" style={{ margin: '0 0 14px' }}>
            AI suggestions based on your order history. Nothing is added until you click Add.
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
