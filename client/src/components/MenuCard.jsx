import { useState } from 'react';
import { VegMark } from './Common.jsx';
import { fmt } from '../api.js';

function isInWindow(tag) {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  if (tag === 'Lunch') return h >= 11 && h < 16;
  if (tag === 'Dinner') return h >= 18;
  return true;
}

export default function MenuCard({ item, onAdd, canOrder = true }) {
  const [portion, setPortion] = useState(item.portions[0]?.label || '');
  const [addons, setAddons] = useState([]);
  const [showAddons, setShowAddons] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const inWindow = isInWindow(item.menu_tag);
  const price = item.portions.length
    ? (item.portions.find((p) => p.label === portion) || item.portions[0]).price
    : item.price;
  const addonTotal = addons.reduce(
    (s, a) => s + (item.addons.find((x) => x.label === a)?.price || 0),
    0
  );
  const windowShort =
    item.menu_tag === 'Dinner'
      ? 'Dinner only'
      : item.menu_tag === 'Lunch'
      ? 'Lunch only'
      : null;

  const disabled = !canOrder || item.outOfStock || !inWindow;

  return (
    <article className="card menu-card" style={{ opacity: item.outOfStock ? 0.6 : 1 }}>
      {/* Photo */}
      <div className="menu-photo">
        {imgFailed ? (
          <div className="food-img food-fallback">
            <span className="serif">{item.name}</span>
          </div>
        ) : (
          <img
            className="food-img"
            src={item.photo}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        )}
        {item.outOfStock && <span className="photo-badge">Out of stock</span>}
        {!item.outOfStock && !inWindow && windowShort && (
          <span className="photo-badge">{windowShort}</span>
        )}
      </div>

      {/* Body */}
      <div className="menu-body">
        <div className="menu-name-row">
          <h3 className="serif menu-name">{item.name}</h3>
          <span className="price menu-price">{fmt(price + addonTotal)}</span>
        </div>
        <p className="small menu-desc">
          <VegMark veg={item.veg} />
          {item.description}
        </p>
        <div className="menu-tags">
          <span className={`tag ${item.spice === 'Hot' || item.spice === 'Very Hot' ? 'hot' : ''}`}>
            {item.spice}
          </span>
          {item.allergens && (
            <span className="tag" title={`Allergens: ${item.allergens}`}>Allergens: {item.allergens}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="menu-footer">
        {/* Portion selector */}
        {item.portions.length > 0 && (
          item.portions.length <= 3 ? (
            <div className="portion-chips" role="group" aria-label="Portion">
              {item.portions.map((pp) => (
                <button
                  key={pp.label}
                  type="button"
                  className={`portion-chip-btn ${portion === pp.label ? 'active' : ''}`}
                  onClick={() => setPortion(pp.label)}
                >
                  {pp.label} · {fmt(pp.price)}
                </button>
              ))}
            </div>
          ) : (
            <select
              aria-label="Portion"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
            >
              {item.portions.map((pp) => (
                <option key={pp.label} value={pp.label}>
                  {pp.label} — {fmt(pp.price)}
                </option>
              ))}
            </select>
          )
        )}

        {/* Add-ons */}
        {item.addons.length > 0 && (
          <>
            <button
              type="button"
              className="btn btn-sec btn-sm btn-full"
              onClick={() => setShowAddons(!showAddons)}
            >
              {showAddons ? 'Hide add-ons' : `Customise · ${item.addons.length} add-on${item.addons.length > 1 ? 's' : ''}`}
              {addons.length ? ` (${addons.length} chosen)` : ''}
            </button>
            {showAddons && (
              <div className="addon-list">
                {item.addons.map((a) => (
                  <label key={a.label} className="addon-row">
                    <input
                      type="checkbox"
                      checked={addons.includes(a.label)}
                      onChange={() =>
                        setAddons(
                          addons.includes(a.label)
                            ? addons.filter((x) => x !== a.label)
                            : [...addons, a.label]
                        )
                      }
                    />
                    <span>{a.label}</span>
                    <strong>{fmt(a.price)}</strong>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        {!canOrder ? (
          <button className="btn btn-sec btn-full" disabled>
            Customer ordering only
          </button>
        ) : item.outOfStock ? (
          <button className="btn btn-sec btn-full" disabled>
            Out of stock
          </button>
        ) : !inWindow ? (
          <button className="btn btn-sec btn-full" disabled>
            {windowShort || 'Not available now'}
          </button>
        ) : (
          <button
            className="btn btn-full"
            onClick={() => onAdd(item, portion, addons)}
          >
            Add · {fmt(price + addonTotal)}
          </button>
        )}
      </div>
    </article>
  );
}

