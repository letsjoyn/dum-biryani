// Nav.jsx — Clean, sharp, minimalist navigation without emojis or rounded bubbles
import { useState } from 'react';

export default function Nav({
  view, setView, user, setUser, setToken,
  cartCount, onCartOpen, setAuthNotice,
  outletName, areaName, onOpenLocationModal,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (v) => { setView(v); setMenuOpen(false); };
  const signOut = () => { setToken(null); setUser(null); go('menu'); };
  const signIn = () => { setAuthNotice(''); go('login'); };

  const showTrack = user?.role === 'customer';
  const showKitchen = user?.role === 'manager';
  const showAdmin = user?.role === 'manager';
  const isStaff = user?.role === 'kitchen' || user?.role === 'manager';

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          {/* Brand */}
          <div className="brand" onClick={() => go('menu')}>Dum <i>House</i></div>

          {/* Quick Location indicator */}
          {outletName && (
            <button
              type="button"
              className="location-pill-btn"
              onClick={onOpenLocationModal}
              title="Change outlet or delivery area"
            >
              <span className="loc-label">Delivering to</span>
              <span className="loc-val">{areaName || 'Hyderabad'} · {outletName}</span>
              <span className="loc-arrow">▼</span>
            </button>
          )}

          {/* Desktop nav links */}
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

            {/* Mobile Hamburger */}
            <button
              type="button"
              className="btn btn-sec btn-sm nav-toggle"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {menuOpen && (
          <div className="wrap nav-mobile-panel">
            {user && (
              <div className="small muted" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                Signed in as <strong>{user.name}</strong> ({user.role}) {user.points != null && `· ${user.points} points`}
              </div>
            )}
            {outletName && (
              <button
                type="button"
                className="nav-panel-btn loc-mobile"
                onClick={() => { setMenuOpen(false); onOpenLocationModal(); }}
              >
                Outlet: {outletName} ({areaName}) · Change
              </button>
            )}
            <button className={`nav-panel-btn ${view === 'menu' ? 'active' : ''}`} onClick={() => go('menu')}>
              Order Menu
            </button>
            {showTrack && (
              <button className={`nav-panel-btn ${view === 'track' ? 'active' : ''}`} onClick={() => go('track')}>
                My Orders & Tracking
              </button>
            )}
            <button className={`nav-panel-btn ${view === 'party' ? 'active' : ''}`} onClick={() => go('party')}>
              Party Orders (Bulk)
            </button>
            {showKitchen && (
              <button className={`nav-panel-btn ${view === 'kitchen' ? 'active' : ''}`} onClick={() => go('kitchen')}>
                Kitchen Display System
              </button>
            )}
            {showAdmin && (
              <button className={`nav-panel-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => go('admin')}>
                Admin Dashboard & CMS
              </button>
            )}
            <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
              {user ? (
                <button className="nav-panel-btn" onClick={signOut}>Sign out</button>
              ) : (
                <button className="nav-panel-btn" onClick={signIn}>Sign in</button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
