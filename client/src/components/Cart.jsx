// Cart.jsx — full-screen drawer with checkout flow
import { useState, useEffect, useRef } from 'react';
import { api, fmt } from '../api.js';
import { Err } from './Common.jsx';

export default function Cart({
  cart, setCart, onClose, user, outlet, outletId,
  areaName, cartNotice, onDismissNotice, goLogin, onOrdered,
}) {
  const requestKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dh-${Date.now()}-${Math.random()}`
  );
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponErr, setCouponErr] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [payMethod, setPayMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(!!user?.marketing_opt_in);
  const [deliveryAddress, setDeliveryAddress] = useState(areaName || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0);
  const couponOff = couponInfo
    ? couponInfo.kind === 'percent'
      ? Math.floor(subtotal * couponInfo.value / 100)
      : Math.min(couponInfo.value, subtotal)
    : 0;
  const afterCoupon = subtotal - couponOff;
  const points = user?.points || 0;
  const loyaltyOff = usePoints ? Math.min(Math.floor(points / 100) * 50, afterCoupon) : 0;
  const payable = Math.max(0, afterCoupon - loyaltyOff);
  const gst = Math.round(payable * 5 / 105 * 100) / 100;

  useEffect(() => {
    api('/api/estimate', {
      method: 'POST',
      body: { outletId, itemIds: cart.map((c) => c.itemId) },
      auth: false,
    }).then(setEstimate).catch(() => {});
  }, [outletId, cart.length]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyCoupon = async () => {
    setCouponErr('');
    try {
      const c = await api(`/api/coupons/${coupon.trim().toUpperCase()}`, { auth: false });
      if (subtotal < c.min_order) throw new Error(`This coupon needs an order above ${fmt(c.min_order)}.`);
      setCouponInfo(c);
    } catch (e) { setCouponErr(e.message); setCouponInfo(null); }
  };

  const place = async () => {
    if (!user) { localStorage.setItem('dh_after_login', 'menu'); goLogin(); return; }
    if (user.role !== 'customer') { setErr('Only customer accounts can place orders.'); return; }
    if (!deliveryAddress.trim()) { setErr('Add a delivery address before placing your order.'); return; }
    if (payMethod === 'Card' && card.replace(/\D/g, '').length < 4) {
      setErr('Enter a test card number (any test number except one ending in 0000).');
      return;
    }
    setErr(''); setBusy(true);
    try {
      const cardLast4 = card.replace(/\D/g, '').slice(-4);
      const order = await api('/api/orders', {
        method: 'POST',
        body: {
          outletId,
          items: cart.map((c) => ({ itemId: c.itemId, portion: c.portion, addons: c.addons, qty: c.qty })),
          paymentMethod: payMethod,
          couponCode: couponInfo?.code,
          usePoints,
          cardLast4,
          upiId,
          requestKey: requestKey.current,
          marketingOptIn,
          deliveryAddress: deliveryAddress.trim(),
        },
      });
      onOrdered(order);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Your order" aria-modal="true">
        {/* Header */}
        <div className="drawer-header">
          <div className="row">
            <h2 className="serif" style={{ fontSize: 26, margin: 0 }}>Your order</h2>
            <button className="btn btn-sec btn-sm" onClick={onClose} aria-label="Close cart">✕</button>
          </div>
          <p className="small muted" style={{ marginTop: 4 }}>
            {outlet?.name} · FSSAI {outlet?.fssai} · Prices include 5% GST
          </p>
        </div>

        {/* Scrollable content */}
        <div className="drawer-scroll">
          {cartNotice && (
            <div className="banner" style={{ marginBottom: 12 }}>
              {cartNotice}
              <button type="button" className="btn btn-sec btn-sm" style={{ marginLeft: 8 }} onClick={onDismissNotice}>Dismiss</button>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 0' }}>
              <h3 className="serif" style={{ fontSize: 22 }}>Your cart is empty</h3>
              <p className="muted">Add dishes from the menu to get started.</p>
              <button className="btn btn-sec" onClick={onClose}>Browse menu</button>
            </div>
          ) : (
            <>
              {/* Items */}
              {cart.map((c) => (
                <div key={c.key} className="cart-item">
                  <div className="cart-item-info" style={{ flex: 1 }}>
                    <div className="row">
                      <strong>{c.name}</strong>
                      <span className="price">{fmt(c.unitPrice * c.qty)}</span>
                    </div>
                    <div className="small muted" style={{ margin: '2px 0 6px' }}>
                      {[c.portion, c.addons.length ? c.addons.join(', ') : '', `${fmt(c.unitPrice)} each`]
                        .filter(Boolean).join(' · ')}
                    </div>
                    <div className="cart-item-actions">
                      <button
                        className="qty-btn"
                        aria-label="Decrease quantity"
                        onClick={() => setCart(cart.map((x) => x.key === c.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                      >−</button>
                      <span className="qty-num">{c.qty}</span>
                      <button
                        className="qty-btn"
                        aria-label="Increase quantity"
                        onClick={() => setCart(cart.map((x) => x.key === c.key ? { ...x, qty: Math.min(20, x.qty + 1) } : x))}
                      >+</button>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => setCart(cart.filter((x) => x.key !== c.key))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <hr className="divider" />

              {/* Coupon */}
              <div>
                <label style={{ marginBottom: 6 }}>Coupon code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    aria-label="Coupon code"
                    placeholder="e.g. DIRECT10"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                  />
                  <button className="btn btn-sec" style={{ whiteSpace: 'nowrap' }} onClick={applyCoupon}>Apply</button>
                </div>
                <p className="hint">Try DIRECT10 (10% off) or WELCOME100 (₹100 off over ₹499).</p>
                {couponErr && <p className="small" style={{ color: '#7A2E12', marginTop: 4 }}>{couponErr}</p>}
                {couponInfo && <p className="small" style={{ color: '#1A7F37', marginTop: 4 }}>✓ {couponInfo.code} — {couponInfo.description}</p>}
              </div>

              {/* Loyalty Reward Card */}
              {user && (
                <div className={`cart-loyalty-card ${usePoints ? 'applied' : ''}`}>
                  <div className="cart-loyalty-header">
                    <div className="cart-loyalty-tag">
                      <span className="cart-loyalty-dot">✦</span>
                      <span>HOUSE LOYALTY · 5% BACK</span>
                    </div>
                    <span className="cart-loyalty-balance">{points} Pts Available</span>
                  </div>

                  {points >= 100 ? (
                    <div className="cart-loyalty-row">
                      <div className="cart-loyalty-info">
                        <strong className="cart-loyalty-save-text">
                          Save {fmt(Math.floor(points / 100) * 50)} on this order
                        </strong>
                        <span className="cart-loyalty-rule">Redeems {Math.floor(points / 100) * 100} points (₹50 off per 100 pts)</span>
                      </div>
                      <button
                        type="button"
                        className={`cart-loyalty-btn ${usePoints ? 'applied' : ''}`}
                        onClick={() => setUsePoints(!usePoints)}
                      >
                        {usePoints ? 'Applied ✓' : `Redeem −${fmt(Math.floor(points / 100) * 50)}`}
                      </button>
                    </div>
                  ) : (
                    <div className="cart-loyalty-progress-note">
                      Earn {Math.floor(subtotal / 20)} pts on this order. Reach 100 pts to unlock ₹50 instant checkout discount.
                    </div>
                  )}
                </div>
              )}

              <hr className="divider" />

              {/* Delivery address */}
              <div>
                <label htmlFor="delivery-address">Delivery address</label>
                <textarea
                  id="delivery-address"
                  rows={2}
                  placeholder="Flat, street, landmark"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
                <p className="hint">Pre-filled with your area — edit to your exact address.</p>
              </div>

              {/* Bill */}
              <hr className="divider" />
              <div>
                <div className="bill-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {couponOff > 0 && <div className="bill-row" style={{ color: '#1A7F37' }}><span>Coupon ({couponInfo?.code})</span><span>−{fmt(couponOff)}</span></div>}
                {loyaltyOff > 0 && <div className="bill-row" style={{ color: '#1A7F37' }}><span>Loyalty points</span><span>−{fmt(loyaltyOff)}</span></div>}
                <div className="bill-row"><span className="muted">GST 5% (included)</span><span className="muted">{fmt(gst)}</span></div>
                <div className="bill-row total"><span>To pay</span><span>{fmt(payable)}</span></div>
                <p className="hint" style={{ marginTop: 6 }}>You'll earn {Math.floor(payable / 20)} loyalty points on this order.</p>
              </div>

              {/* Prep estimate */}
              {estimate && (
                <div className="banner info" style={{ marginTop: 12 }}>
                  <strong>Promised in ~{estimate.promised} min</strong>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Base {estimate.base} min + kitchen queue {estimate.queueLoad} min · {estimate.activeOrders} orders active.
                    Never below {estimate.outletMinimum} min minimum.
                  </div>
                </div>
              )}

              {/* Payment */}
              <hr className="divider" />
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Test payment · no real money</div>
                <div className="segmented" role="group" aria-label="Payment method">
                  <button type="button" className={payMethod === 'UPI' ? 'on' : ''} aria-pressed={payMethod === 'UPI'} onClick={() => setPayMethod('UPI')}>UPI</button>
                  <button type="button" className={payMethod === 'Card' ? 'on' : ''} aria-pressed={payMethod === 'Card'} onClick={() => setPayMethod('Card')}>Card</button>
                </div>
                {payMethod === 'UPI' ? (
                  <div style={{ marginTop: 10 }}>
                    <label>UPI ID (optional)</label>
                    <input placeholder="name@okhdfc" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <label>Test card number</label>
                    <input placeholder="4242 4242 4242 4242" value={card} onChange={(e) => setCard(e.target.value)} />
                    <p className="hint">Card ending 0000 simulates a declined payment.</p>
                  </div>
                )}
              </div>

              {/* Marketing opt-in */}
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginTop: 14 }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
                <span className="small">Send me offers and marketing messages (optional, DPDP Act 2023). Order updates are transactional and always sent.</span>
              </label>

              <Err msg={err} />
            </>
          )}
        </div>

        {/* Sticky footer */}
        {cart.length > 0 && (
          <div className="drawer-footer">
            <button
              className="btn btn-full"
              disabled={busy || cart.length === 0}
              onClick={place}
            >
              {busy
                ? 'Processing test payment…'
                : user
                ? `Pay ${fmt(payable)} · Test mode`
                : 'Sign in to place order'}
            </button>
            <p className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>
              Checkout target: under 60 seconds. No card details stored.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

