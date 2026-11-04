// Nav.jsx — top bar + mobile bottom navigation
import { useState } from 'react';
import { fmt } from '../api.js';

// SVG icons (inline, no dependency)
const icons = {
  order: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  party: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  kitchen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
};

export default function Nav({
  view, setView, user, setUser, setToken,
  cartCount, onCartOpen, setAuthNotice,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (v) => { setView(v); setMenuOpen(false); };
  const signOut = () => { setToken(null); setUser(null); go('menu'); };
  const signIn = () => { setAuthNotice(''); go('login'); };

  // Which nav items to show
  const showTrack = user?.role === 'customer';
  const showKitchen = user?.role === 'manager';
  const showAdmin = user?.role === 'manager';
  const isStaff = user?.role === 'kitchen' || user?.role === 'manager';

  return (
    <>
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="brand" onClick={() => go('menu')}>Dum <i>House</i></div>

          {/* Desktop nav */}
          <nav className="nav-desktop" aria-label="Main">
            <button className={view === 'menu' ? 'on' : ''} onClick={() => go('menu')}>Order</button>
            {showTrack && <button className={view === 'track' ? 'on' : ''} onClick={() => go('track')}>My orders</button>}
            <button className={view === 'party' ? 'on' : ''} onClick={() => go('party')}>Party orders</button>
            {showKitchen && <button className={view === 'kitchen' ? 'on' : ''} onClick={() => go('kitchen')}>Kitchen</button>}
            {showAdmin && <button className={view === 'admin' ? 'on' : ''} onClick={() => go('admin')}>Admin</button>}
          </nav>

          {/* Top-right actions */}
          <div className="top-actions">
            {user ? (
              <>
                <span className="user-pill" title={`${user.name} · ${user.role}`}>
                  {user.name.split(' ')[0]}
                  {user.points != null && (
                    <span className="pts" style={{ display: 'none' }}>
                      {/* shown on wider screens via media query below */}
                      · {user.points} pts
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-sec btn-sm"
                  style={{ display: 'none' }}  // shown by .nav-desktop-only below
                  id="desktop-signout"
                  onClick={signOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button className="btn btn-sm" id="desktop-signin" onClick={signIn}
                style={{ display: 'none' }}
              >
                Sign in
              </button>
            )}

            {/* Cart button — not for managers */}
            {!isStaff && view !== 'login' && (
              <button
                className="btn btn-sm"
                onClick={onCartOpen}
                aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}
              >
                {icons.cart}
                {cartCount > 0 && cartCount}
              </button>
            )}

            {/* Hamburger (mobile) */}
            <button
              type="button"
              className="btn btn-sec btn-sm nav-toggle"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {icons.menu}
            </button>
          </div>
        </div>

        {/* Mobile slide-down panel */}
        {menuOpen && (
          <div className="wrap nav-mobile-panel">
            {user && (
              <div className="small muted" style={{ padding: '4px 8px 8px' }}>
                {user.name} · {user.role}{user.points != null ? ` · ${user.points} pts` : ''}
              </div>
            )}
            <button className="nav-panel-btn" onClick={() => go('menu')}>🍽 Order</button>
            {showTrack && <button className="nav-panel-btn" onClick={() => go('track')}>📦 My orders</button>}
            <button className="nav-panel-btn" onClick={() => go('party')}>🎉 Party orders</button>
            {showKitchen && <button className="nav-panel-btn" onClick={() => go('kitchen')}>👨‍🍳 Kitchen</button>}
            {showAdmin && <button className="nav-panel-btn" onClick={() => go('admin')}>📊 Admin</button>}
            <hr className="divider" />
            {user
              ? <button className="nav-panel-btn" onClick={signOut}>Sign out</button>
              : <button className="nav-panel-btn" onClick={signIn}>Sign in</button>
            }
          </div>
        )}
      </header>

      {/* ── Bottom nav (mobile only, hidden on KDS) ── */}
      {user?.role !== 'kitchen' && (
        <nav className="bottom-nav" aria-label="Bottom navigation">
          <button className={`bnav-item ${view === 'menu' ? 'on' : ''}`} onClick={() => go('menu')}>
            {icons.order}
            Order
          </button>

          {showTrack && (
            <button className={`bnav-item ${view === 'track' ? 'on' : ''}`} onClick={() => go('track')}>
              {icons.track}
              My orders
            </button>
          )}

          <button
            className={`bnav-item ${cartCount > 0 ? 'on' : ''}`}
            onClick={onCartOpen}
            style={{ position: 'relative' }}
            aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}
          >
            {icons.cart}
            {cartCount > 0 && (
              <span className="bnav-cart-bubble">{cartCount}</span>
            )}
            Cart
          </button>

          <button className={`bnav-item ${view === 'party' ? 'on' : ''}`} onClick={() => go('party')}>
            {icons.party}
            Party
          </button>

          {showAdmin && (
            <button className={`bnav-item ${view === 'admin' ? 'on' : ''}`} onClick={() => go('admin')}>
              {icons.admin}
              Admin
            </button>
          )}

          {!user && (
            <button className="bnav-item" onClick={signIn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 22, height: 22 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Sign in
            </button>
          )}
        </nav>
      )}

      {/* Show desktop sign-in/out buttons via CSS */}
      <style>{`
        @media (min-width: 761px) {
          #desktop-signout, #desktop-signin { display: inline-flex !important; }
          .user-pill .pts { display: inline !important; }
        }
      `}</style>
    </>
  );
}
