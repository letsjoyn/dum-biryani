// Nav.jsx — Clean, responsive navbar without awkward full-width accordions
import { useState } from 'react';

export default function Nav({
  view, setView, user, setUser, setToken,
  cartCount, onCartOpen, setAuthNotice,
  outletName, areaName, onOpenLocationModal,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (v) => { setView(v); setMobileOpen(false); };
  const signOut = () => { setToken(null); setUser(null); go('menu'); };
  const signIn = () => { setAuthNotice(''); go('login'); };

  const showTrack = user?.role === 'customer';
  const showKitchen = user?.role === 'manager';
  const showAdmin = user?.role === 'manager';
  const isStaff = user?.role === 'kitchen' || user?.role === 'manager';

  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        {/* Brand */}
        <div className="brand" onClick={() => go('menu')}>
          Dum <i>House</i>
        </div>

        {/* Location selector button */}
        {outletName && (
          <button
            type="button"
            className="location-pill-btn"
            onClick={onOpenLocationModal}
            title="Change outlet or delivery area"
          >
            <span className="loc-label">Delivering to</span>
            <span className="loc-val">{areaName} · {outletName}</span>
            <span className="loc-arrow">▼</span>
          </button>
        )}

        {/* Desktop Nav Links — visible on laptops, tablets, desktop */}
        <nav className="nav-desktop" aria-label="Main navigation">
          <button className={`nav-link ${view === 'menu' ? 'active' : ''}`} onClick={() => go('menu')}>
            Order
          </button>
          {showTrack && (
            <button className={`nav-link ${view === 'track' ? 'active' : ''}`} onClick={() => go('track')}>
              My orders
            </button>
          )}
          <button className={`nav-link ${view === 'party' ? 'active' : ''}`} onClick={() => go('party')}>
            Party orders
          </button>
          {showKitchen && (
            <button className={`nav-link ${view === 'kitchen' ? 'active' : ''}`} onClick={() => go('kitchen')}>
              Kitchen
            </button>
          )}
          {showAdmin && (
            <button className={`nav-link ${view === 'admin' ? 'active' : ''}`} onClick={() => go('admin')}>
              Admin
            </button>
          )}
        </nav>

        {/* Right actions */}
        <div className="top-actions">
          {user ? (
            <div className="user-info-group">
              <span className="user-badge" title={`${user.name} (${user.role})`}>
                <strong>{user.name.split(' ')[0]}</strong>
                {user.points != null && <span className="user-pts">· {user.points} pts</span>}
              </span>
              <button
                type="button"
                className="btn btn-sec btn-sm"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-sec btn-sm"
              onClick={signIn}
            >
              Sign in
            </button>
          )}

          {/* Cart Button */}
          {!isStaff && view !== 'login' && (
            <button
              type="button"
              className="cart-nav-btn"
              onClick={onCartOpen}
              aria-label={`Cart ${cartCount ? `with ${cartCount} items` : 'empty'}`}
            >
              <span className="cart-text">Cart</span>
              <span className={`cart-count ${cartCount > 0 ? 'has-items' : ''}`}>
                {cartCount}
              </span>
            </button>
          )}

          {/* Mobile hamburger — ONLY on small phone screens (< 680px) */}
          <button
            type="button"
            className="mobile-nav-trigger"
            aria-label="Navigation menu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Sleek Mobile Drawer (Clean, compact, NOT a giant stacked table!) */}
      {mobileOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileOpen(false)}>
          <div className="mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <span className="brand" style={{ fontSize: 22 }}>Dum <i>House</i></span>
              <button className="btn btn-sec btn-sm" onClick={() => setMobileOpen(false)}>✕</button>
            </div>

            {user && (
              <div className="mobile-drawer-user">
                <strong>{user.name}</strong> ({user.role})
                {user.points != null && <div className="small muted">{user.points} loyalty points</div>}
              </div>
            )}

            {outletName && (
              <button
                type="button"
                className="mobile-drawer-loc-btn"
                onClick={() => { setMobileOpen(false); onOpenLocationModal(); }}
              >
                <span>Delivering to <strong>{areaName}</strong> ({outletName})</span>
                <span className="small" style={{ textDecoration: 'underline' }}>Change</span>
              </button>
            )}

            <div className="mobile-drawer-links">
              <button className={`drawer-link ${view === 'menu' ? 'active' : ''}`} onClick={() => go('menu')}>
                Order Menu
              </button>
              {showTrack && (
                <button className={`drawer-link ${view === 'track' ? 'active' : ''}`} onClick={() => go('track')}>
                  My Orders & Live Tracking
                </button>
              )}
              <button className={`drawer-link ${view === 'party' ? 'active' : ''}`} onClick={() => go('party')}>
                Bulk & Party Orders
              </button>
              {showKitchen && (
                <button className={`drawer-link ${view === 'kitchen' ? 'active' : ''}`} onClick={() => go('kitchen')}>
                  Kitchen Display
                </button>
              )}
              {showAdmin && (
                <button className={`drawer-link ${view === 'admin' ? 'active' : ''}`} onClick={() => go('admin')}>
                  Admin Dashboard
                </button>
              )}
            </div>

            <div className="mobile-drawer-footer">
              {user ? (
                <button className="btn btn-sec btn-full" onClick={signOut}>Sign out</button>
              ) : (
                <button className="btn btn-full" onClick={signIn}>Sign in</button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
