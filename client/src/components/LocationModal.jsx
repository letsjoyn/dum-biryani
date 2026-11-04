// LocationModal.jsx — Clean, lightweight modal to select delivery area & kitchen outlet
import { useState, useEffect } from 'react';

const AREAS = [
  ['Kondapur', 17.461, 78.342],
  ['HITEC City', 17.443, 78.381],
  ['Madhapur', 17.448, 78.389],
  ['Gachibowli', 17.440, 78.350],
  ['Jubilee Hills', 17.432, 78.407],
  ['Banjara Hills', 17.415, 78.437],
  ['Kukatpally', 17.484, 78.408],
  ['Miyapur', 17.496, 78.361],
  ['Financial District', 17.425, 78.340],
  ['Manikonda', 17.420, 78.367],
  ['Begumpet', 17.440, 78.460],
  ['Secunderabad', 17.440, 78.500],
  ['Ameerpet', 17.437, 78.448],
  ['Tolichowki', 17.399, 78.418],
  ['Dilsukhnagar', 17.368, 78.524],
  ['Uppal', 17.398, 78.558],
  ['Kavuri Hills', 17.445, 78.395],
  ['Pragati Nagar', 17.502, 78.390],
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

export default function LocationModal({
  isOpen, onClose, outlets, outletId, setOutletId, areaName, setAreaName,
}) {
  const [geoNote, setGeoNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const area = AREAS.find((a) => a[0] === areaName) || AREAS[0];
  const outletsWithDistance = outlets.map((o) => ({
    ...o,
    distanceKm: o.lat && o.lon ? haversineKm(area[1], area[2], o.lat, o.lon) : 0,
  }));
  const inRadius = outletsWithDistance
    .filter((o) => o.distanceKm <= o.delivery_radius_km)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const outsideRadius = outlets.length > 0 && inRadius.length === 0;

  const pickArea = (name) => {
    setAreaName(name);
    setGeoNote('');
    const targetArea = AREAS.find((a) => a[0] === name);
    if (targetArea) {
      const nearest = outlets
        .map((o) => ({ ...o, dist: haversineKm(targetArea[1], targetArea[2], o.lat, o.lon) }))
        .sort((a, b) => a.dist - b.dist)
        .find((o) => o.dist <= o.delivery_radius_km);
      if (nearest) setOutletId(nearest.id);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoNote('Geolocation not available in your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearestArea = [...AREAS].sort((a, b) =>
          haversineKm(latitude, longitude, a[1], a[2]) - haversineKm(latitude, longitude, b[1], b[2])
        )[0];
        if (nearestArea) setAreaName(nearestArea[0]);

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
      () => setGeoNote('Location access denied - pick an area from the list.')
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Select Delivery Location">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Select Delivery Location</h3>
            <p className="small muted" style={{ margin: '4px 0 0' }}>Orders route automatically to the selected kitchen.</p>
          </div>
          <button
            type="button"
            className="btn btn-sec btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label htmlFor="modal-area-select" style={{ fontSize: 13, fontWeight: 600 }}>Delivery Area (Hyderabad)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select
              id="modal-area-select"
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
                    onClick={() => { setOutletId(o.id); onClose(); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setOutletId(o.id); onClose(); } }}
                  >
                    <div className="row">
                      <strong style={{ fontSize: 15 }}>{o.name}</strong>
                      {o.id === outletId && <span className="badge-selected">Selected</span>}
                    </div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      ~{o.distanceKm.toFixed(1)} km away · Delivery within {o.delivery_radius_km} km
                    </div>
                    <div className="small muted">FSSAI: {o.fssai} · Min prep: {o.min_prep_minutes} min</div>
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
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
