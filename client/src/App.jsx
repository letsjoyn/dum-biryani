import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setToken, token, socketUrl } from './api.js';
import './styles.css';

import Nav from './components/Nav.jsx';
import Cart from './components/Cart.jsx';
import LocationModal from './components/LocationModal.jsx';

import MenuPage from './pages/MenuPage.jsx';
import TrackPage from './pages/TrackPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PartyPage from './pages/PartyPage.jsx';

const VALID_VIEWS = ['menu', 'track', 'party', 'admin', 'kitchen', 'login'];

function getInitialView() {
  const h = window.location.hash.replace('#', '');
  return VALID_VIEWS.includes(h) ? h : 'menu';
}

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authNotice, setAuthNotice] = useState('');

  // ── Routing ──────────────────────────────────────────────────────
  const [view, setView] = useState(getInitialView);

  // ── Outlets & menu ────────────────────────────────────────────────
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(() => Number(localStorage.getItem('dh_outlet')) || 1);
  const [areaName, setAreaName] = useState(() => localStorage.getItem('dh_area') || 'Kondapur');
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Cart ──────────────────────────────────────────────────────────
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dh_cart') || '[]'); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState('');

  // ── AI suggestions ────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [sugMsg, setSugMsg] = useState('');

  // ── Location Modal State ──────────────────────────────────────────
  const [showLocModal, setShowLocModal] = useState(false);

  // ── Auth Animation State ──────────────────────────────────────────
  const [authAnimation, setAuthAnimation] = useState(null); // { type: 'signin' | 'signout', role?: string, name?: string }
  const [latestOrderNo, setLatestOrderNo] = useState(null);
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);

  const handleSignInSuccess = (u) => {
    setAuthAnimation({ type: 'signin', role: u.role, name: u.name });
    setTimeout(() => {
      setUser(u);
      setAuthNotice('');
      setAuthAnimation(null);
      let after = null;
      try { after = localStorage.getItem('dh_after_login'); localStorage.removeItem('dh_after_login'); } catch {}
      const allowed = after && !roleForView(after, u);
      const target = allowed ? after : (u.role === 'manager' ? 'admin' : (u.role === 'kitchen' ? 'kitchen' : 'menu'));
      setView(target);
      window.scrollTo(0, 0);
    }, 1100);
  };

  const handleSignOut = () => {
    setAuthAnimation({ type: 'signout' });
    setTimeout(() => {
      setToken(null);
      setUser(null);
      setAuthAnimation(null);
      setView('login');
      window.scrollTo(0, 0);
    }, 1050);
  };

  const handleOrderSuccess = (newOrder) => {
    setCart([]);
    setCartOpen(false);
    setOrderSuccessModal(newOrder);
  };

  const finishOrderSuccess = () => {
    if (!orderSuccessModal) return;
    const ordNo = orderSuccessModal.order_no;
    setOrderSuccessModal(null);
    setLatestOrderNo(ordNo);
    setView('track');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (orderSuccessModal) {
      const timer = setTimeout(() => {
        finishOrderSuccess();
      }, 2300);
      return () => clearTimeout(timer);
    }
  }, [orderSuccessModal]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const handleQuickCustomerLogin = async () => {
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'customer@demo.in', password: 'Demo123!' },
        auth: false,
      });
      setToken(data.token);
      handleSignInSuccess(data.user);
    } catch (e) {
      setAuthNotice('Sign in failed: ' + e.message);
      setView('login');
    }
  };

  const socketRef = useRef(null);

  // ── Persist ───────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('dh_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('dh_outlet', String(outletId)); }, [outletId]);
  useEffect(() => { localStorage.setItem('dh_area', areaName); }, [areaName]);

  // ── Load user ─────────────────────────────────────────────────────
  const loadMe = async () => {
    const startedWith = token();
    try { const me = await api('/api/auth/me'); setUser(me); }
    catch { setUser(null); if (token() === startedWith) setToken(null); }
    finally { setAuthChecked(true); }
  };
  useEffect(() => {
    loadMe();
    api('/api/outlets').then((list) => {
      setOutlets(list);
      if (list && list.length > 0) {
        setOutletId((prev) => (!prev || !list.some((o) => o.id === prev)) ? list[0].id : prev);
      }
    }).catch(() => {});
  }, []);

  // ── Session expiry event ──────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      setToken(null); setUser(null);
      setAuthNotice(e.detail || 'Session expired — please sign in again.');
      setView('login');
    };
    window.addEventListener('dh:session-expired', h);
    return () => window.removeEventListener('dh:session-expired', h);
  }, []);

  // ── Route guards ──────────────────────────────────────────────────
  const roleForView = (v, u) => {
    if (v === 'track') return null; // Allow all visitors to view TrackPage (displays login prompt if guest)
    if (v === 'admin') return !u ? 'login' : (u.role === 'manager' ? null : 'denied');
    if (v === 'kitchen') return !u ? 'login' : (['kitchen', 'manager'].includes(u.role) ? null : 'denied');
    return null;
  };

  useEffect(() => {
    if (!authChecked) return;
    const r = roleForView(view, user);
    if (r === 'login') {
      try { localStorage.setItem('dh_after_login', view); } catch {}
      setAuthNotice(
        view === 'admin' ? 'Please sign in as a manager to open Admin.'
        : view === 'kitchen' ? 'Please sign in as kitchen staff to open the kitchen display.'
        : 'Please sign in to see your orders.'
      );
      setView('login');
    }
  }, [view, authChecked, user?.id]);

  // ── Hash routing ──────────────────────────────────────────────────
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (VALID_VIEWS.includes(h)) setView(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const h = `#${view}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h);
  }, [view]);

  // ── Menu loading ──────────────────────────────────────────────────
  const loadMenu = async () => {
    setLoading(true); setError('');
    try { setMenu(await api(`/api/menu?outletId=${outletId}`, { auth: false })); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { loadMenu(); }, [outletId]);

  // ── AI suggestions ────────────────────────────────────────────────
  useEffect(() => {
    if (user?.role === 'customer') api('/api/suggestions').then(setSuggestions).catch(() => {});
  }, [user]);

  // ── Socket ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = socketRef.current; if (!s) return;
    s.auth = { token: token() };
    if (s.connected) { s.disconnect(); s.connect(); }
  }, [user?.id]);

  useEffect(() => {
    const s = socketRef.current; if (!s) return;
    s.emit('join-outlet', outletId);
    return () => { s.emit('leave-outlet', outletId); };
  }, [outletId]);

  useEffect(() => {
    const s = io(socketUrl, { transports: ['websocket', 'polling'], auth: { token: token() } });
    socketRef.current = s;
    s.on('menu:updated', (m) => {
      if (Number(m.outletId) === Number(localStorage.getItem('dh_outlet'))) loadMenu();
    });
    s.on('connect', () => loadMenu());
    return () => s.disconnect();
  }, []);

  // ── Cart helpers ──────────────────────────────────────────────────
  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  // Re-price cart when menu refreshes
  useEffect(() => {
    if (!menu.length || !cartRef.current.length) return;
    const prev = cartRef.current; const next = []; const dropped = []; let priceChanged = false;
    for (const c of prev) {
      const item = menu.find((m) => m.id === c.itemId);
      if (!item) { dropped.push(`${c.name} is no longer on this outlet's menu`); continue; }
      if (item.outOfStock) { dropped.push(`${c.name} was paused and removed`); continue; }
      let unit = item.price; let portion = c.portion;
      if (item.portions.length) {
        const found = item.portions.find((pp) => pp.label === c.portion) || item.portions[0];
        unit = found.price; portion = found.label;
      }
      c.addons.forEach((a) => { const f = item.addons.find((x) => x.label === a); if (f) unit += f.price; });
      if (unit !== c.unitPrice || portion !== c.portion) priceChanged = true;
      next.push({ ...c, unitPrice: unit, portion });
    }
    if (dropped.length || priceChanged) {
      setCart(next);
      setCartNotice([...dropped, priceChanged ? 'Prices were updated to match the current menu.' : ''].filter(Boolean).join(' '));
    }
  }, [menu]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0);

  function addToCart(item, portion, addons) {
    let unit = item.price;
    if (item.portions.length) unit = (item.portions.find((p) => p.label === portion) || item.portions[0]).price;
    addons.forEach((a) => { const f = item.addons.find((x) => x.label === a); if (f) unit += f.price; });
    const key = `${item.id}|${portion}|${addons.join(',')}`;
    setCart((prev) => {
      const ex = prev.find((c) => c.key === key);
      if (ex) return prev.map((c) => c.key === key ? { ...c, qty: Math.min(20, c.qty + 1) } : c);
      return [...prev, { key, itemId: item.id, name: item.name, portion: portion || '', addons, qty: 1, unitPrice: unit }];
    });
  }

  function updateCartQty(key, nextQty) {
    setCart((prev) => {
      if (nextQty <= 0) return prev.filter((c) => c.key !== key);
      return prev.map((c) => c.key === key ? { ...c, qty: Math.min(20, nextQty) } : c);
    });
  }

  function addSuggestion(sug) {
    const item = menu.find((m) => m.name === sug.item_name);
    if (!item) { setSugMsg('That item is not on this outlet menu right now.'); return; }
    if (item.outOfStock) { setSugMsg('That item is out of stock here right now.'); return; }
    addToCart(item, sug.portion || (item.portions[0]?.label || ''), []);
    setCartOpen(true);
  }

  // ── Auth Animation Renderer ───────────────────────────────────────
  const renderAuthModal = () => {
    if (!authAnimation) return null;
    const isSignIn = authAnimation.type === 'signin';
    const role = authAnimation.role || 'customer';

    let badge = 'CUSTOMER SESSION';
    let title = `Welcome, ${authAnimation.name ? authAnimation.name.split(' ')[0] : 'Customer'}`;
    let sub = 'Preparing your live menu, saved cart & 5% loyalty balance…';

    if (!isSignIn) {
      badge = 'SESSION TERMINATED';
      title = 'Signing you out…';
      sub = 'Session credentials cleared · Returning to sign in';
    } else if (role === 'kitchen') {
      badge = 'LIVE KDS · KITCHEN DISPLAY SYSTEM';
      title = 'Welcome, Kitchen Team';
      sub = 'Connecting live WebSockets to Kondapur order tickets…';
    } else if (role === 'manager') {
      badge = 'CENTRAL OPS · STORE MANAGER CONSOLE';
      title = 'Welcome, Store Manager';
      sub = 'Loading outlet analytics, 86-ing controls & live metrics…';
    }

    return (
      <div className={`auth-anim-overlay ${authAnimation.type} ${role}`} role="alert" aria-live="polite">
        <div className="auth-anim-card">
          <div className="auth-anim-brand">Dum <i>House</i></div>
          <div className="auth-anim-badge">{badge}</div>
          <h2 className="auth-anim-title">{title}</h2>
          <p className="auth-anim-sub">{sub}</p>
          <div className="auth-anim-loader-track">
            <div className="auth-anim-loader-bar" />
          </div>
        </div>
      </div>
    );
  };

  // If full-screen auth animation is active, render it immediately
  if (authAnimation) {
    return renderAuthModal();
  }

  // ── KDS shortcut: kitchen role gets KDS immediately ───────────────
  if (user?.role === 'kitchen') {
    return (
      <KitchenPage
        user={user} setUser={setUser}
        outlets={outlets} socketRef={socketRef}
        onSignOut={handleSignOut}
      />
    );
  }

  // Manager viewing kitchen view
  if (user?.role === 'manager' && view === 'kitchen') {
    return (
      <KitchenPage
        user={user} setUser={setUser}
        outlets={outlets} socketRef={socketRef}
        onBack={() => setView('admin')} backLabel="← Back to Admin"
        onSignOut={handleSignOut}
      />
    );
  }

  const outlet = outlets.find((o) => o.id === outletId);

  const deniedText = (v) =>
    v === 'admin' ? `Admin is for managers only. You are signed in as ${user?.role}.`
    : v === 'kitchen' ? `The kitchen display is for kitchen staff. You are signed in as ${user?.role}.`
    : `My orders is for customer accounts. You are signed in as ${user?.role}.`;

  return (
    <div>
      <Nav
        view={view} setView={setView}
        user={user} setUser={setUser}
        setToken={setToken}
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        setAuthNotice={setAuthNotice}
        outletName={outlet?.name}
        areaName={areaName}
        onOpenLocationModal={() => setShowLocModal(true)}
        onSignOut={handleSignOut}
      />

      <main className={`wrap ${view === 'track' ? 'main-track-view' : ''}`}>
        {/* Auth-check loading */}
        {!authChecked && ['track', 'admin', 'kitchen'].includes(view) && (
          <div className="card" style={{ marginTop: 24 }}>Checking your sign-in…</div>
        )}

        {/* Access denied */}
        {authChecked && roleForView(view, user) === 'denied' && (
          <div className="card" style={{ marginTop: 24, maxWidth: 500 }}>
            <div className="eyebrow">Access</div>
            <h2 className="serif" style={{ fontSize: 28, margin: '8px 0' }}>This page isn't for your account.</h2>
            <p className="muted">{deniedText(view)}</p>
            <button className="btn" onClick={() => setView('menu')}>Back to Order</button>
          </div>
        )}

        {/* Login */}
        {!(authChecked && roleForView(view, user) === 'denied') && view === 'login' && (
          <LoginPage
            notice={authNotice}
            onDone={handleSignInSuccess}
          />
        )}

        {/* Menu */}
        {view === 'menu' && (
          <MenuPage
            user={user} outlets={outlets}
            outletId={outletId} setOutletId={setOutletId}
            areaName={areaName} setAreaName={setAreaName}
            menu={menu} loading={loading} error={error} loadMenu={loadMenu}
            cart={cart} addToCart={addToCart} onUpdateQty={updateCartQty}
            suggestions={suggestions} addSuggestion={addSuggestion}
            sugMsg={sugMsg} setSugMsg={setSugMsg}
            cartNotice={cartNotice} setCartNotice={setCartNotice}
            onOpenLocationModal={() => setShowLocModal(true)}
          />
        )}

        {/* Track */}
        {view === 'track' && authChecked && (
          <TrackPage
            user={user}
            socketRef={socketRef}
            latestOrderNo={latestOrderNo}
            onGoLogin={() => { setAuthNotice(''); setView('login'); }}
            onQuickCustomerLogin={handleQuickCustomerLogin}
          />
        )}

        {/* Party */}
        {view === 'party' && (
          <PartyPage
            user={user} outlets={outlets}
            goLogin={() => { setAuthNotice(''); setView('login'); }}
          />
        )}

        {/* Admin */}
        {view === 'admin' && user?.role === 'manager' && (
          <AdminPage outlets={outlets} />
        )}
      </main>

      {/* Global Location Switcher Modal — Works from any tab */}
      <LocationModal
        isOpen={showLocModal}
        onClose={() => setShowLocModal(false)}
        outlets={outlets}
        outletId={outletId}
        setOutletId={setOutletId}
        areaName={areaName}
        setAreaName={setAreaName}
      />

      {/* Footer - hidden on tracking and kitchen views to avoid outer page scroll */}
      {view !== 'track' && view !== 'kitchen' && (
        <footer className="wrap footer">
          Dum House (demo) · Prices include 5% GST · FSSAI licences shown per outlet · Test payments only — no real money moves.
        </footer>
      )}

      {/* Full-Screen Animated Auth Transitions */}
      {renderAuthModal()}

      {/* Zomato-style Order Placed Success Celebration Modal */}
      {orderSuccessModal && (
        <div className="order-success-overlay" role="dialog" aria-modal="true" aria-label="Order placed successfully">
          <div className="order-success-card">
            {/* Animated Tick Circle with Pulsing Glow */}
            <div className="success-tick-circle">
              <svg className="success-svg-check" viewBox="0 0 52 52">
                <path className="success-svg-path" fill="none" d="M14 27 l8 8 l16 -16" />
              </svg>
            </div>

            <div className="eyebrow" style={{ color: '#10B981', marginBottom: 4, letterSpacing: '0.12em' }}>
              DIRECT KITCHEN CONFIRMATION
            </div>
            <h2 className="order-success-title">Order Placed Successfully!</h2>
            <p className="order-success-subtitle">
              Sent straight to the live kitchen screen at <strong>{orderSuccessModal.outlet_name || 'outlet'}</strong>.
            </p>

            <div className="order-success-meta-pill">
              <div style={{ textAlign: 'left' }}>
                <span className="small muted" style={{ display: 'block', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.05em' }}>Order Number</span>
                <strong style={{ fontSize: 15, color: '#FFFFFF' }}>#{orderSuccessModal.order_no}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="small muted" style={{ display: 'block', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.05em' }}>Amount Paid</span>
                <strong style={{ fontSize: 16, color: '#10B981' }}>₹{Number(orderSuccessModal.payable).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {orderSuccessModal.delivery_address && (
              <div className="small muted" style={{ marginBottom: 18, color: '#A1A1AA' }}>
                Delivering to: <strong style={{ color: '#F4F4F5' }}>{orderSuccessModal.delivery_address}</strong>
              </div>
            )}

            <button
              type="button"
              className="order-success-btn"
              onClick={finishOrderSuccess}
            >
              Track Order Live Now →
            </button>
            <div className="small muted" style={{ marginTop: 10, fontSize: 11.5, color: '#71717A' }}>
              Opening live order tracking…
            </div>
          </div>
        </div>
      )}

      {/* Sticky cart pill */}
      {cartCount > 0 && !cartOpen && view === 'menu' && (
        <div className="sticky-cart" role="region" aria-label="Cart summary">
          <div className="sticky-cart-info">
            <span className="sticky-cart-badge">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
            <span className="sticky-cart-price">₹{cartTotal.toLocaleString('en-IN')}</span>
            <span className="sticky-cart-gst">incl. 5% GST</span>
          </div>
          <button
            type="button"
            className="sticky-cart-btn"
            onClick={() => setCartOpen(true)}
          >
            <span>View cart</span>
            <span className="sticky-cart-arrow">→</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <Cart
          cart={cart} setCart={setCart}
          onClose={() => setCartOpen(false)}
          user={user} outlet={outlet}
          outletId={outletId} areaName={areaName}
          cartNotice={cartNotice} onDismissNotice={() => setCartNotice('')}
          goLogin={() => { setCartOpen(false); setView('login'); }}
          onOrdered={handleOrderSuccess}
        />
      )}
    </div>
  );
}
