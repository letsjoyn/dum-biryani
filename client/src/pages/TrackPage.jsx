// TrackPage.jsx — Split workspace on desktop (zero outer scroll) + clean drill-down on mobile (tap order to view details)
import { useState, useEffect } from 'react';
import { api, fmt, fmtTime } from '../api.js';
import { Err, StatusBadge } from '../components/Common.jsx';

const STAGES = ['Placed', 'Preparing', 'Ready', 'Rider handoff', 'Handed over'];

function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function stageSentence(s) {
  return {
    Placed: 'Order placed & received',
    Preparing: 'Kitchen preparing your food',
    Ready: 'Food packed & ready for pickup',
    'Rider handoff': 'Rider picked up order',
    'Handed over': 'Delivered successfully',
    Cancelled: 'Order cancelled',
  }[s] || s;
}

export default function TrackPage({ user, socketRef, onGoLogin, onQuickCustomerLogin }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false); // Mobile drill-down state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ledger, setLedger] = useState([]);
  const [optIn, setOptIn] = useState(!!user?.marketing_opt_in);
  const now = useNow(15000);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api('/api/loyalty/history').then(setLedger).catch(() => {});
  }, [user]);

  const toggleOptIn = async (v) => {
    setOptIn(v);
    try { await api('/api/auth/me', { method: 'PATCH', body: { marketing_opt_in: v } }); }
    catch { setOptIn(!v); }
  };

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setErr('');
    try {
      const o = await api('/api/orders/mine');
      setOrders(o);
      if (o.length > 0) {
        setSelectedOrder((prev) => {
          if (!prev) return o[0];
          return o.find((x) => x.order_no === prev.order_no) || o[0];
        });
      }
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const s = socketRef?.current; if (!s || !user) return;
    const h = (o) => {
      setOrders((prev) => prev.map((x) => x.order_no === o.order_no ? o : x));
      setSelectedOrder((prev) => prev && prev.order_no === o.order_no ? o : prev);
    };
    const onConnect = () => { load(); orders.forEach((o) => s.emit('join-order', o.order_no)); };
    s.on('order:updated', h);
    s.on('connect', onConnect);
    orders.forEach((o) => s.emit('join-order', o.order_no));
    return () => { s.off('order:updated', h); s.off('connect', onConnect); };
  }, [orders.length, user]);

  if (!user) {
    return (
      <div className="tracking-logged-out-hero" style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: '36px 28px', textAlign: 'center', border: '1px solid var(--line)' }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 8 }}>Live Order Tracking</div>
          <h2 className="serif" style={{ fontSize: 32, margin: '0 0 10px', color: 'var(--ink)' }}>
            Track Your Orders & Rewards
          </h2>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
            Sign in to view real-time kitchen preparation status, delivery timestamps, and redeem your loyalty points.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="btn btn-full"
              style={{ minHeight: 44, fontSize: 14.5 }}
              onClick={onGoLogin}
            >
              Sign In to Your Account →
            </button>

            <button
              type="button"
              className="btn btn-sec btn-full"
              style={{ minHeight: 44, fontSize: 13.5 }}
              onClick={onQuickCustomerLogin}
            >
              One-Click Demo Customer Login
            </button>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Live KDS</strong>
              <span className="small muted">Stage updates</span>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Honest AI</strong>
              <span className="small muted">Queue prep-time</span>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>5% Rewards</strong>
              <span className="small muted">Loyalty credit</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const o = selectedOrder;
  const isCancelled = o?.status === 'Cancelled';
  const stageIdx = isCancelled ? -1 : STAGES.indexOf(o?.status);
  const isLate = o?.minutesLate > 0 && !['Ready', 'Handed over', 'Cancelled'].includes(o?.status);

  const stageTime = (s) => {
    if (!o) return null;
    if (s === 'Placed') return o.created_at;
    const e = (o.events || []).find((ev) => (ev.to_status || ev.status) === s);
    return e ? e.created_at : null;
  };

  const promised = o ? new Date(o.promised_at) : null;
  const remainingMins = promised ? Math.max(0, Math.round((promised - now) / 60000)) : 0;
  const deliveredAt = stageTime('Handed over');

  const headline = !o ? ''
    : isCancelled ? 'Order Cancelled'
    : o.status === 'Handed over' ? `Delivered at ${deliveredAt ? new Date(deliveredAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : fmtTime(o.promised_at)}`
    : o.status === 'Ready' ? 'Ready for pickup'
    : isLate ? `Running late by ${o.minutesLate} min`
    : `Arriving in ~${remainingMins} min`;

  const updates = (o?.events || [])
    .map((e) => ({ at: e.created_at, text: stageSentence(e.to_status || e.status) }))
    .filter((u) => u.text);

  const handleSelectOrder = (ord) => {
    setSelectedOrder(ord);
    setMobileDetailOpen(true); // On mobile: immediately open details view
  };

  return (
    <div className="tracking-workspace-wrap">
      <Err msg={err} retry={load} />

      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 24, width: '40%', margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto' }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="card empty-state" style={{ marginTop: 24 }}>
          <h2 className="serif" style={{ fontSize: 26 }}>No orders yet</h2>
          <p className="muted">Your freshly made dum biryani is waiting on the menu.</p>
        </div>
      ) : (
        <div className={`tracking-split-view ${mobileDetailOpen ? 'mobile-show-details' : 'mobile-show-list'}`}>
          {/* ── LEFT PANE: Orders List (Desktop split or Mobile list) ── */}
          <div className="tracking-orders-sidebar">
            <div className="sidebar-sticky-header">
              <div className="eyebrow">Your History</div>
              <h2 className="serif" style={{ fontSize: 22, margin: '2px 0 0' }}>All Orders ({orders.length})</h2>
            </div>

            <div className="tracking-orders-scroll-area">
              {orders.map((ord) => {
                const isSelected = selectedOrder?.order_no === ord.order_no;
                return (
                  <div
                    key={ord.order_no}
                    className={`order-row-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectOrder(ord)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectOrder(ord); }}
                  >
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 14 }}>{ord.outlet_name}</strong>
                      <span className="price" style={{ fontSize: 13.5 }}>{fmt(ord.payable)}</span>
                    </div>

                    <div className="small muted" style={{ marginTop: 2 }}>
                      #{ord.order_no} · {new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(ord.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </div>

                    <div className="order-items-snippet" style={{ marginTop: 4 }}>
                      {ord.items.map((it) => `${it.item_name} ×${it.qty}`).join(', ')}
                    </div>

                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <StatusBadge status={ord.status} />
                      <span className="small view-details-text">
                        {isSelected ? 'Viewing →' : 'Tap to track →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Loyalty points mini widget */}
            <div className="sidebar-loyalty-box">
              <div className="row">
                <span className="small"><strong>Loyalty Balance</strong></span>
                <span className="price" style={{ color: 'var(--green)' }}>{user.points} pts</span>
              </div>
              <div className="small muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                1 pt per ₹20 spent · 100 pts = ₹50 off checkout
              </div>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, marginTop: 8, fontSize: 11.5 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={optIn} onChange={(e) => toggleOptIn(e.target.checked)} />
                SMS / WhatsApp Updates
              </label>
            </div>
          </div>

          {/* ── RIGHT PANE: Live Tracking & Details (Desktop split or Mobile details view) ── */}
          <div className="tracking-details-pane">
            {o ? (
              <div className="tracking-details-scroll-content">
                {/* Mobile Back Button to return to Orders List */}
                <button
                  type="button"
                  className="mobile-back-to-orders-btn"
                  onClick={() => setMobileDetailOpen(false)}
                >
                  ← Back to all orders
                </button>

                {/* 1. Header Banner */}
                <div className="tracking-status-banner">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <div className="eyebrow" style={{ color: '#E2DFD8' }}>
                        {o.outlet_name} Kitchen · {o.payment_method} · #{o.order_no}
                      </div>
                      <h1 className="serif" style={{ fontSize: 26, margin: '4px 0 2px', color: '#fff' }}>
                        {headline}
                      </h1>
                      <p className="small" style={{ margin: 0, color: '#C8C5BE' }}>
                        Promised by {fmtTime(o.promised_at)} · {o.outlet_name} Outlet
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="price" style={{ fontSize: 18, color: '#fff' }}>{fmt(o.payable)}</span>
                      <div style={{ marginTop: 4 }}><StatusBadge status={o.status} /></div>
                    </div>
                  </div>

                  {isLate && (
                    <div className="banner late" style={{ marginTop: 12 }}>
                      <strong>Running late — kitchen is expediting.</strong> Outlet manager notified.
                    </div>
                  )}
                </div>

                {/* 2. Step by Step Live Timeline */}
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Order Preparation Progress</h3>
                  <div className="order-timeline-clean">
                    {STAGES.map((s, i) => {
                      const done = !isCancelled && i <= stageIdx;
                      const current = !isCancelled && i === stageIdx;
                      const at = stageTime(s);
                      return (
                        <div key={s} className={`timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                          <div className="step-indicator">
                            {done ? '✓' : i + 1}
                          </div>
                          <div className="step-info">
                            <div className="step-title">
                              <strong>{s}</strong>
                              {current && <span className="step-now-badge">In Progress</span>}
                            </div>
                            {at && (
                              <span className="small muted">
                                {new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isCancelled && <p className="small muted" style={{ marginTop: 8 }}>Order was cancelled.</p>}
                </div>

                {/* 3. Delivery Address */}
                {o.delivery_address && (
                  <div className="card" style={{ marginTop: 14, padding: '12px 16px' }}>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>Delivery Destination</div>
                    <strong style={{ fontSize: 14 }}>{o.delivery_address}</strong>
                  </div>
                )}

                {/* 4. Ordered Items Breakdown */}
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Items in this Order ({o.items.length})</h3>
                  <div style={{ borderTop: '1px solid var(--line)' }}>
                    {o.items.map((it, i) => (
                      <div key={i} className="order-item-compact-row">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: 14 }}>{it.item_name}</strong>
                            <span className="small muted">× {it.qty}</span>
                          </div>
                          {[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).length > 0 && (
                            <div className="small muted" style={{ marginTop: 2, fontSize: 12 }}>
                              {[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        <span className="price" style={{ fontSize: 13.5 }}>{fmt(it.unit_price * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Bill Summary */}
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Payment & Tax Receipt</h3>
                  <div className="bill-row"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
                  {o.coupon_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Coupon Discount</span><span>−{fmt(o.coupon_off)}</span></div> : null}
                  {o.loyalty_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Loyalty Points Redeemed</span><span>−{fmt(o.loyalty_off)}</span></div> : null}
                  <div className="bill-row"><span className="muted">GST 5% (Included)</span><span className="muted">{fmt(o.gst_amount)}</span></div>
                  <div className="bill-row total"><span>Total Paid</span><span>{fmt(o.payable)}</span></div>

                  {(o.points_earned > 0 || o.points_used > 0) && (
                    <p className="small muted" style={{ marginTop: 10, padding: '8px 12px', background: '#F8F7F4' }}>
                      {o.points_earned > 0 ? `+${o.points_earned} loyalty points earned on this order. ` : ''}
                      {o.points_used > 0 ? `${o.points_used} points redeemed.` : ''}
                    </p>
                  )}
                </div>

                {/* 6. Notification Log */}
                {updates.length > 0 && (
                  <div className="card" style={{ marginTop: 14 }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Order Activity Log</h3>
                    <div className="timeline-v">
                      {updates.map((u, i) => (
                        <div key={i} className="tl-row done">
                          <span className="tl-dot">✓</span>
                          <span className="tl-text">
                            {u.text}
                            <span className="small muted"> · {new Date(u.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <p className="muted">Select an order to view tracking details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
