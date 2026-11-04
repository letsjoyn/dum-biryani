// Common.jsx — shared helper components
import { useState } from 'react';

export function VegMark({ veg }) {
  return (
    <span
      className={`vegmark ${veg ? '' : 'nonveg'}`}
      title={veg ? 'Veg' : 'Non-veg'}
      role="img"
      aria-label={veg ? 'Veg' : 'Non-veg'}
    >
      <i />
    </span>
  );
}

export function Err({ msg, retry }) {
  if (!msg) return null;
  return (
    <div className="banner err" style={{ marginBottom: 12 }}>
      {msg}
      {retry && (
        <button type="button" className="btn btn-sec btn-sm" style={{ marginLeft: 12 }} onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function MenuSkeletons({ count = 6 }) {
  return (
    <div className="menu-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="skeleton" style={{ height: 180, borderRadius: 0 }} />
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ width: '70%', height: 16 }} />
            <div className="skeleton" style={{ width: '40%', height: 14 }} />
            <div className="skeleton" style={{ width: '100%', height: 40, marginTop: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  const cls =
    status === 'Ready' ? 'ready' :
    status === 'Handed over' ? 'done' :
    status === 'Cancelled' ? 'cancelled' : 'live';
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

export function ItemThumb({ photo, name }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed)
    return <span className="item-thumb item-thumb-fallback serif">{name.charAt(0)}</span>;
  return (
    <img
      className="item-thumb"
      src={photo}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
