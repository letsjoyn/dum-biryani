// MenuPage.jsx — outlet picker + menu grid
import { useState, useEffect, useMemo, useRef } from 'react';
import { api, fmt } from '../api.js';
import MenuCard from '../components/MenuCard.jsx';
import { Err, MenuSkeletons } from '../components/Common.jsx';

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
  addSuggestion, sugMsg, setSugMsg, cartNotice, setCartNotice, socketRef,
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
    if (!navigator.geolocation) { setGeoNote('Geolocation not available — pick an area.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ranked = outletsWithDistance
          .map((o) => ({ ...o, d: haversineKm(latitude, longitude, o.lat, o.lon) }))
          .sort((a, b) => a.d - b.d);
        const near = ranked.find((o) => o.d <= o.delivery_radius_km);
        if (!near) {
          setGeoNote(`Outside every delivery radius (nearest: ${ranked[0]?.name} ~${ranked[0]?.d.toFixed(1)} km). Pick an area.`);
          return;
        }
        setGeoNote(`Nearest: ${near.name} (~${near.d.toFixed(1)} km).`);
        setOutletId(near.id);
      },
      () => setGeoNote('Location denied — pick an area.')
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
          Hyderabadi biryani ordered direct — no marketplace commission, an honest
          prep time, and your order on the kitchen screen the second you pay.
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

      {/* ── Outlet picker ── */}
      <div className="card picker-card section-gap">
        <label htmlFor="area-select">Where are you?</label>
        <div className="picker-row">
          <select
            id="area-select"
            value={areaName}
            onChange={(e) => pickArea(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {AREAS.map((a) => <option key={a[0]} value={a[0]}>{a[0]}</option>)}
          </select>
          <button type="button" className="btn btn-sec" style={{ whiteSpace: 'nowrap' }} onClick={useMyLocation}>
            📍 Use my location
          </button>
        </div>

        {geoNote && (
          <div className="banner" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <span className="small">{geoNote}</span>
            <button type="button" className="btn btn-sec btn-sm" onClick={() => setGeoNote('')}>✕</button>
          </div>
        )}

        {outsideRadius ? (
          <>
            <div className="banner err" style={{ marginTop: 12 }}>
              <strong>Outside delivery radius.</strong> No outlet delivers to {area[0]} yet — try Kondapur, Gachibowli or Kukatpally.
            </div>
            <select disabled aria-label="Outlet" style={{ marginTop: 10 }}>
              <option>No outlet delivers to this area</option>
            </select>
          </>
        ) : (
          <>
            <div className="eyebrow" style={{ marginTop: 16 }}>Delivering outlet — tap to pick</div>
            <div className="outlet-cards">
              {inRadius.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`outlet-card ${o.id === outletId ? 'on' : ''}`}
                  onClick={() => setOutletId(o.id)}
                  aria-pressed={o.id === outletId}
                >
                  <span className="outlet-card-top">
                    <strong>{o.name}</strong>
                    {o.id === outletId && <span className="outlet-check">✓ Selected</span>}
                  </span>
                  <span className="small muted">~{o.distanceKm.toFixed(1)} km · radius {o.delivery_radius_km} km</span>
                  <span className="small muted">FSSAI {o.fssai}</span>
                </button>
              ))}
            </div>
            {outlet && (
              <p className="small muted picker-line">
                {outlet.address} · {outlet.phone} · Min prep {outlet.min_prep_minutes} min
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Sticky filters ── */}
      {!outsideRadius && (
        <div className="filters-sticky section-gap">
          <div className="search-bar">
            <input
              aria-label="Search the menu"
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          <div className="pill-row">
            <button
              type="button"
              className={`veg-toggle ${vegOnly ? 'on' : ''}`}
              aria-pressed={vegOnly}
              onClick={() => setVegOnly(!vegOnly)}
            >
              <span className={`switch ${vegOnly ? 'on' : ''}`}><i /></span>
              Veg only
            </button>
            {cats.map((c) => (
              <button
                key={c}
                className={`chip ${cat === c ? 'on' : ''}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Menu content ── */}
      <div className="section-gap">
        {cartNotice && (
          <div className="banner" style={{ marginBottom: 16 }}>
            {cartNotice}
            <button type="button" className="btn btn-sec btn-sm" style={{ marginLeft: 8 }} onClick={() => setCartNotice('')}>Dismiss</button>
          </div>
        )}
        {menu.some((m) => !isInWindow(m.menu_tag)) && (
          <div className="banner" style={{ marginBottom: 16 }}>
            Some dishes are lunch or dinner only — they'll appear when their time window opens.
          </div>
        )}

        {outsideRadius ? (
          <div className="card">
            <h2 className="serif" style={{ fontSize: 26 }}>No menu here yet.</h2>
            <p className="muted">Choose a delivery area above that an outlet serves.</p>
          </div>
        ) : (
          <>
            <Err msg={error} retry={loadMenu} />
            {loading
              ? <MenuSkeletons count={6} />
              : filtered.length === 0
              ? (
                <div className="card empty-state">
                  <h2 className="serif" style={{ fontSize: 24 }}>Nothing matches.</h2>
                  <p className="muted">Try a different dish, or clear the veg filter.</p>
                  <button className="btn btn-sec" onClick={() => { setSearch(''); setVegOnly(false); setCat('All'); }}>
                    Clear filters
                  </button>
                </div>
              )
              : (
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
              )
            }
          </>
        )}
      </div>

      {/* ── AI "Order again" suggestions ── */}
      {user?.role === 'customer' && visibleSuggestions.length > 0 && (
        <section className="card section-gap">
          <div className="eyebrow">Order again</div>
          <h2 className="serif" style={{ fontSize: 24, margin: '6px 0 4px' }}>From your last orders</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Suggestions only — nothing is added until you tap Add. Today's prices at this outlet.
          </p>
          {sugMsg && (
            <div className="banner" style={{ marginBottom: 10 }}>
              {sugMsg}
              <button type="button" className="btn btn-sec btn-sm" style={{ marginLeft: 8 }} onClick={() => setSugMsg('')}>Dismiss</button>
            </div>
          )}
          {visibleSuggestions.map((s, i) => (
            <div key={i} className="suggest-row">
              <div>
                <strong>{s.item_name}</strong>
                {s.portion && <span className="small muted"> · {s.portion}</span>}
                <span className="small muted"> · {fmt(s.currentPrice)}</span>
              </div>
              <button className="btn btn-sm" onClick={() => addSuggestion(s)}>Add</button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
