// LocationModal.jsx — Global modal to switch outlet or delivery area with interactive Hyderabad delivery map
import { useState, useEffect, useMemo } from 'react';

// 35+ Detailed Greater Hyderabad localities with coordinates and zone classification
const HYD_LOCALITIES = [
  // West Hyderabad / IT Corridor
  { name: 'Kondapur', zone: 'West (IT Hub)', lat: 17.461, lon: 78.342 },
  { name: 'HITEC City', zone: 'West (IT Hub)', lat: 17.443, lon: 78.381 },
  { name: 'Madhapur', zone: 'West (IT Hub)', lat: 17.448, lon: 78.389 },
  { name: 'Gachibowli', zone: 'West (IT Hub)', lat: 17.440, lon: 78.350 },
  { name: 'Financial District', zone: 'West (IT Hub)', lat: 17.425, lon: 78.340 },
  { name: 'Nanakramguda', zone: 'West (IT Hub)', lat: 17.419, lon: 78.348 },
  { name: 'Raidurg', zone: 'West (IT Hub)', lat: 17.431, lon: 78.375 },
  { name: 'Jubilee Hills', zone: 'West (IT Hub)', lat: 17.432, lon: 78.407 },
  { name: 'Banjara Hills', zone: 'West (IT Hub)', lat: 17.415, lon: 78.437 },
  { name: 'Film Nagar', zone: 'West (IT Hub)', lat: 17.416, lon: 78.409 },
  { name: 'Manikonda', zone: 'West (IT Hub)', lat: 17.420, lon: 78.367 },
  { name: 'Kavuri Hills', zone: 'West (IT Hub)', lat: 17.445, lon: 78.395 },
  { name: 'Shaikpet', zone: 'West (IT Hub)', lat: 17.408, lon: 78.397 },

  // North & North-West Hyderabad
  { name: 'Kukatpally', zone: 'North & Secunderabad', lat: 17.484, lon: 78.408 },
  { name: 'KPHB Colony', zone: 'North & Secunderabad', lat: 17.493, lon: 78.400 },
  { name: 'Miyapur', zone: 'North & Secunderabad', lat: 17.496, lon: 78.361 },
  { name: 'Nizampet', zone: 'North & Secunderabad', lat: 17.514, lon: 78.378 },
  { name: 'Pragati Nagar', zone: 'North & Secunderabad', lat: 17.502, lon: 78.390 },
  { name: 'Bachupally', zone: 'North & Secunderabad', lat: 17.531, lon: 78.365 },
  { name: 'Begumpet', zone: 'North & Secunderabad', lat: 17.440, lon: 78.460 },
  { name: 'Secunderabad', zone: 'North & Secunderabad', lat: 17.440, lon: 78.500 },
  { name: 'Bowenpally', zone: 'North & Secunderabad', lat: 17.472, lon: 78.479 },
  { name: 'Kompally', zone: 'North & Secunderabad', lat: 17.538, lon: 78.487 },
  { name: 'Sainikpuri', zone: 'North & Secunderabad', lat: 17.489, lon: 78.547 },

  // Central & Heritage Old City
  { name: 'Ameerpet', zone: 'Central & Heritage', lat: 17.437, lon: 78.448 },
  { name: 'Somajiguda', zone: 'Central & Heritage', lat: 17.426, lon: 78.455 },
  { name: 'Punjagutta', zone: 'Central & Heritage', lat: 17.428, lon: 78.451 },
  { name: 'Himayatnagar', zone: 'Central & Heritage', lat: 17.402, lon: 78.487 },
  { name: 'Abids', zone: 'Central & Heritage', lat: 17.391, lon: 78.474 },
  { name: 'Nampally', zone: 'Central & Heritage', lat: 17.387, lon: 78.468 },
  { name: 'Mehdipatnam', zone: 'Central & Heritage', lat: 17.394, lon: 78.435 },
  { name: 'Tolichowki', zone: 'Central & Heritage', lat: 17.399, lon: 78.418 },
  { name: 'Charminar', zone: 'Central & Heritage', lat: 17.361, lon: 78.474 },
  { name: 'Malakpet', zone: 'Central & Heritage', lat: 17.373, lon: 78.498 },

  // East & Outer Ring
  { name: 'Dilsukhnagar', zone: 'East Hub', lat: 17.368, lon: 78.524 },
  { name: 'LB Nagar', zone: 'East Hub', lat: 17.345, lon: 78.552 },
  { name: 'Uppal', zone: 'East Hub', lat: 17.398, lon: 78.558 },
  { name: 'Habsiguda', zone: 'East Hub', lat: 17.412, lon: 78.541 },
  { name: 'Tarnaka', zone: 'East Hub', lat: 17.428, lon: 78.530 },
  { name: 'Nagole', zone: 'East Hub', lat: 17.378, lon: 78.567 },
];

const INDIA_CITIES = [
  { name: 'Hyderabad (Core HQ)', active: true, desc: '14 Dining Outlets + 3 Cloud Kitchens active with 30-min delivery' },
  { name: 'Bengaluru', active: false, desc: 'Indiranagar & Koramangala flagship outlets launching Q3 2027' },
  { name: 'Mumbai', active: false, desc: 'Bandra & Lower Parel central kitchen pilot in development' },
  { name: 'Delhi NCR', active: false, desc: 'Gurugram CyberHub hub planned' },
  { name: 'Chennai', active: false, desc: 'Anna Nagar express delivery hub planned' },
];

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLa = ((bLat - aLat) * Math.PI) / 180;
  const dLo = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// Coordinate mapping for Hyderabad SVG Canvas
// Bounding box: Lat [17.33, 17.55], Lon [78.30, 78.59]
function geoToSvg(lat, lon, width = 560, height = 300) {
  const minLat = 17.33, maxLat = 17.55;
  const minLon = 78.30, maxLon = 78.59;
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
  return { x: Math.max(10, Math.min(width - 10, x)), y: Math.max(10, Math.min(height - 10, y)) };
}

export default function LocationModal({
  isOpen, onClose, outlets, outletId, setOutletId, areaName, setAreaName,
}) {
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [activeTab, setActiveTab] = useState('hyd'); // 'hyd' | 'india' | 'map'
  const [geoNote, setGeoNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  // Current delivery location lookup
  const currentArea = useMemo(() => {
    return HYD_LOCALITIES.find((a) => a.name.toLowerCase() === areaName?.toLowerCase()) || HYD_LOCALITIES[0];
  }, [areaName]);

  // Calculate distance from delivery location to all outlets
  const outletsWithDistance = useMemo(() => {
    return outlets.map((o) => {
      const distanceKm = o.lat && o.lon ? haversineKm(currentArea.lat, currentArea.lon, o.lat, o.lon) : 0;
      return {
        ...o,
        distanceKm,
        inRadius: distanceKm <= o.delivery_radius_km,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [outlets, currentArea]);

  const selectedOutlet = outlets.find((o) => o.id === outletId) || outlets[0];

  const inRadius = outletsWithDistance.filter((o) => o.inRadius);
  const outsideRadius = outlets.length > 0 && inRadius.length === 0;

  // Filter localities by search & zone
  const filteredLocalities = useMemo(() => {
    return HYD_LOCALITIES.filter((loc) => {
      const matchesSearch = loc.name.toLowerCase().includes(search.toLowerCase()) ||
        loc.zone.toLowerCase().includes(search.toLowerCase());
      const matchesZone = selectedZone === 'All' || loc.zone === selectedZone;
      return matchesSearch && matchesZone;
    });
  }, [search, selectedZone]);

  const pickArea = (locName) => {
    setAreaName(locName);
    setGeoNote('');
    // Auto-select nearest outlet delivering to this area if current is out of range
    const targetLoc = HYD_LOCALITIES.find((l) => l.name === locName);
    if (targetLoc) {
      const nearest = outlets
        .map((o) => ({ ...o, dist: haversineKm(targetLoc.lat, targetLoc.lon, o.lat, o.lon) }))
        .sort((a, b) => a.dist - b.dist)
        .find((o) => o.dist <= o.delivery_radius_km);
      if (nearest && nearest.id !== outletId) {
        setOutletId(nearest.id);
      }
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoNote('Geolocation not available in your browser.');
      return;
    }
    setGeoNote('Locating your GPS coordinates in Hyderabad…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Find closest locality name
        const nearestLoc = [...HYD_LOCALITIES].sort((a, b) =>
          haversineKm(latitude, longitude, a.lat, a.lon) - haversineKm(latitude, longitude, b.lat, b.lon)
        )[0];

        // Find nearest outlet
        const rankedOutlets = outlets
          .map((o) => ({ ...o, dist: haversineKm(latitude, longitude, o.lat, o.lon) }))
          .sort((a, b) => a.dist - b.dist);
        const near = rankedOutlets.find((o) => o.dist <= o.delivery_radius_km);

        if (nearestLoc) setAreaName(nearestLoc.name);
        if (near) {
          setOutletId(near.id);
          setGeoNote(`GPS detected: Near ${nearestLoc?.name || 'Hyderabad'} — assigned to ${near.name} (~${near.dist.toFixed(1)} km away).`);
        } else {
          setGeoNote(`Outside all 17 delivery radiuses (Nearest: ${rankedOutlets[0]?.name} ~${rankedOutlets[0]?.dist.toFixed(1)} km). Pick an area manually.`);
        }
      },
      () => setGeoNote('Location access denied — please select an area from the Hyderabad list below.')
    );
  };

  if (!isOpen) return null;

  const userPointSvg = geoToSvg(currentArea.lat, currentArea.lon);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Select Outlet & Area">
      <div className="modal-content modal-location-luxury" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: '#B45309' }}>17 HYDERABAD HUBS · DIRECT ROUTING</div>
            <h3 className="serif" style={{ fontSize: 26, margin: '2px 0 0', color: '#1C1917' }}>
              Select Delivery Location
            </h3>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Orders route directly to the kitchen display screen serving your neighbourhood.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sec btn-sm"
            onClick={onClose}
            aria-label="Close modal"
            style={{ minHeight: 34, padding: '4px 10px' }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Hyderabad Localities / Interactive Map / All India */}
        <div className="loc-tab-bar">
          <button
            type="button"
            className={`loc-tab-btn ${activeTab === 'hyd' ? 'active' : ''}`}
            onClick={() => setActiveTab('hyd')}
          >
            Hyderabad Areas ({HYD_LOCALITIES.length})
          </button>
          <button
            type="button"
            className={`loc-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            Interactive City Map 🗺️
          </button>
          <button
            type="button"
            className={`loc-tab-btn ${activeTab === 'india' ? 'active' : ''}`}
            onClick={() => setActiveTab('india')}
          >
            India Expansion
          </button>
        </div>

        <div className="modal-body">
          {/* TAB 1: HYDERABAD LOCALITIES SEARCH & SELECT */}
          {activeTab === 'hyd' && (
            <>
              {/* Search + Locate Me */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Search locality (e.g. Kondapur, Jubilee Hills, Secunderabad)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, minHeight: 40, fontSize: 13.5 }}
                />
                <button
                  type="button"
                  className="btn btn-sec btn-sm"
                  onClick={useMyLocation}
                  style={{ whiteSpace: 'nowrap', minHeight: 40, fontSize: 12.5 }}
                  title="Detect GPS location"
                >
                  📍 Locate Me
                </button>
              </div>

              {/* Zone Filter Chips */}
              <div className="loc-zone-chips">
                {['All', 'West (IT Hub)', 'North & Secunderabad', 'Central & Heritage', 'East Hub'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    className={`loc-chip ${selectedZone === z ? 'active' : ''}`}
                    onClick={() => setSelectedZone(z)}
                  >
                    {z}
                  </button>
                ))}
              </div>

              {geoNote && (
                <div className="banner info" style={{ margin: '8px 0 12px', fontSize: 12.5 }}>
                  {geoNote}
                </div>
              )}

              {/* Selected Area Indicator Bar */}
              <div className="loc-active-pill-bar">
                <span>Delivering to: <strong style={{ color: '#1C1917' }}>{areaName}</strong></span>
                <span className="small muted">Lat: {currentArea.lat.toFixed(3)}, Lon: {currentArea.lon.toFixed(3)}</span>
              </div>

              {/* Area Quick Selector Grid */}
              <div className="loc-chips-grid">
                {filteredLocalities.map((loc) => {
                  const isCur = loc.name.toLowerCase() === areaName?.toLowerCase();
                  return (
                    <button
                      key={loc.name}
                      type="button"
                      className={`loc-tag-btn ${isCur ? 'active' : ''}`}
                      onClick={() => pickArea(loc.name)}
                    >
                      <span>{loc.name}</span>
                      {isCur && <span style={{ color: '#B45309', fontWeight: 800 }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Outlets in Range */}
              <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <div className="eyebrow" style={{ color: '#B45309', marginBottom: 8 }}>
                  Serving Kitchens for {areaName} ({inRadius.length} in radius)
                </div>

                {outsideRadius ? (
                  <div className="banner err" style={{ margin: 0 }}>
                    <strong>Outside standard delivery radius.</strong> No direct outlet covers {areaName} within its radius.
                    Please select a nearby area (e.g. Kondapur, Gachibowli, Kukatpally, Banjara Hills).
                  </div>
                ) : (
                  <div className="outlet-selector-grid">
                    {inRadius.map((o) => {
                      const isSel = o.id === outletId;
                      const isCloud = o.name.toLowerCase().includes('cloud');
                      return (
                        <div
                          key={o.id}
                          className={`outlet-select-card ${isSel ? 'selected' : ''}`}
                          onClick={() => { setOutletId(o.id); onClose(); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') { setOutletId(o.id); onClose(); } }}
                        >
                          <div className="row" style={{ alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: 14.5 }}>{o.name}</strong>
                                {isCloud && <span className="loc-cloud-badge">Cloud Kitchen</span>}
                              </div>
                              <div className="small muted" style={{ marginTop: 2 }}>
                                ~{o.distanceKm.toFixed(1)} km from {areaName} · Delivery within {o.delivery_radius_km} km
                              </div>
                              <div className="small muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                                FSSAI: {o.fssai} · Min prep: {o.min_prep_minutes} mins · 5% GST included
                              </div>
                            </div>
                            {isSel ? (
                              <span className="badge-selected">Selected ✓</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sec btn-sm"
                                style={{ minHeight: 30, fontSize: 12, padding: '4px 10px' }}
                              >
                                Select
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: INTERACTIVE VISUAL HYDERABAD MAP */}
          {activeTab === 'map' && (
            <div className="loc-map-container">
              <div className="loc-map-header">
                <div>
                  <strong style={{ fontSize: 14 }}>Interactive Hyderabad Coverage Map</strong>
                  <div className="small muted">
                    Click any kitchen beacon on the map to switch your delivering outlet.
                  </div>
                </div>
                <div className="small price" style={{ color: '#B45309' }}>
                  {outlets.length} Hubs Plotted
                </div>
              </div>

              {/* SVG Map Canvas */}
              <div className="loc-svg-wrapper">
                <svg
                  viewBox="0 0 560 300"
                  className="loc-svg-map"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Background grid */}
                  <defs>
                    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#EAE6DC" strokeWidth="0.8" />
                    </pattern>
                  </defs>
                  <rect width="560" height="300" fill="#F8F6F0" />
                  <rect width="560" height="300" fill="url(#grid)" />

                  {/* Hussain Sagar Lake representation */}
                  <ellipse cx="370" cy="155" rx="24" ry="18" fill="#DCE9F2" stroke="#B0CCD8" strokeWidth="1.2" />
                  <text x="370" y="159" fontSize="8" fill="#5A7D8F" textAnchor="middle" fontWeight="600">
                    Hussain Sagar
                  </text>

                  {/* Major Expressways / Ring roads */}
                  <path
                    d="M 50 120 Q 200 80, 510 100"
                    fill="none"
                    stroke="#DED7C8"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                  <path
                    d="M 60 250 Q 280 270, 520 220"
                    fill="none"
                    stroke="#DED7C8"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                  <path
                    d="M 120 50 Q 150 180, 260 280"
                    fill="none"
                    stroke="#DED7C8"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />

                  {/* Delivery Radius Circle for currently selected outlet */}
                  {selectedOutlet && (
                    (() => {
                      const selPt = geoToSvg(selectedOutlet.lat, selectedOutlet.lon);
                      // ~1km ≈ 8px in this scale
                      const radiusPx = (selectedOutlet.delivery_radius_km || 8) * 7.5;
                      return (
                        <circle
                          cx={selPt.x}
                          cy={selPt.y}
                          r={radiusPx}
                          fill="rgba(180, 83, 9, 0.08)"
                          stroke="#B45309"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                      );
                    })()
                  )}

                  {/* Outlets Pins */}
                  {outlets.map((o) => {
                    const pt = geoToSvg(o.lat, o.lon);
                    const isSel = o.id === outletId;
                    const isCloud = o.name.toLowerCase().includes('cloud');
                    return (
                      <g
                        key={o.id}
                        transform={`translate(${pt.x}, ${pt.y})`}
                        onClick={() => setOutletId(o.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Selected pulse halo */}
                        {isSel && (
                          <circle r="14" fill="none" stroke="#B45309" strokeWidth="2" opacity="0.6" />
                        )}
                        <circle
                          r={isSel ? 7 : 5}
                          fill={isSel ? '#B45309' : isCloud ? '#0D9488' : '#1C1917'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text
                          x="0"
                          y={isSel ? -11 : -8}
                          fontSize="9.5"
                          fontWeight={isSel ? '800' : '600'}
                          fill={isSel ? '#B45309' : '#333'}
                          textAnchor="middle"
                          style={{ textShadow: '0 1px 2px #fff' }}
                        >
                          {o.name.replace(' Outlet', '').replace(' Cloud Kitchen', ' (CK)')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Customer's current delivery area marker */}
                  <g transform={`translate(${userPointSvg.x}, ${userPointSvg.y})`}>
                    <circle r="9" fill="#DC2626" opacity="0.25" />
                    <circle r="5" fill="#DC2626" stroke="#fff" strokeWidth="2" />
                    <text
                      x="0"
                      y="16"
                      fontSize="9.5"
                      fontWeight="800"
                      fill="#DC2626"
                      textAnchor="middle"
                      style={{ textShadow: '0 1px 2px #fff' }}
                    >
                      📍 {areaName}
                    </text>
                  </g>
                </svg>
              </div>

              {/* Map Legend */}
              <div className="loc-map-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: '#B45309' }} /> Selected Outlet</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#1C1917' }} /> Dining Outlet</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#0D9488' }} /> Cloud Kitchen</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: '#DC2626' }} /> Delivery Locality</span>
              </div>
            </div>
          )}

          {/* TAB 3: ALL INDIA EXPANSION ROADMAP */}
          {activeTab === 'india' && (
            <div style={{ padding: '8px 0' }}>
              <div className="banner info" style={{ marginBottom: 16 }}>
                <strong>Greater Hyderabad Network</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  Dum House operates 14 company-owned dining outlets and 3 high-capacity cloud kitchens across Hyderabad, serving over 1,200 orders/hr during peak rush.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {INDIA_CITIES.map((c) => (
                  <div
                    key={c.name}
                    style={{
                      border: '1px solid var(--line)',
                      padding: '12px 14px',
                      background: c.active ? '#F8F6F0' : '#FFFFFF',
                      borderLeft: c.active ? '4px solid #B45309' : '1px solid var(--line)',
                    }}
                  >
                    <div className="row" style={{ alignItems: 'center' }}>
                      <strong style={{ fontSize: 14 }}>{c.name}</strong>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        background: c.active ? '#FEF3C7' : '#F3F4F6',
                        color: c.active ? '#92400E' : '#6B7280',
                      }}>
                        {c.active ? 'LIVE DIRECT' : 'COMING SOON'}
                      </span>
                    </div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {c.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="small muted">
            Delivering from: <strong style={{ color: '#1C1917' }}>{selectedOutlet?.name}</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ minHeight: 38, padding: '0 20px', fontSize: 13.5 }}
          >
            Confirm &amp; Browse Menu →
          </button>
        </div>
      </div>
    </div>
  );
}
