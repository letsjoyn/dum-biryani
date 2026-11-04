// TrackPage.jsx — Order list with dedicated drill-down Order Details view
import { useState, useEffect } from 'react';
import { api, fmt, fmtTime } from '../api.js';
import { Err, StatusBadge } from '../components/Common.jsx';

const STAGES = ['Placed', 'Preparing', 'Ready', 'Rider handoff', 'Handed over'];

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function stageSentence(s) {
  return {
    Placed: 'Order placed & sent to kitchen',
    Preparing: 'Kitchen preparing your food',
    Ready: 'Food packed & ready for pickup',
    'Rider handoff': 'Rider picked up order',
    'Handed over': 'Order delivered successfully',
    Cancelled: 'Order cancelled',
  }[s] || s;
}

// ── Detail View for a Single Selected Order ──
function OrderDetailView({ order, onBack }) {
  const now = useNow(30000);
  const isCancelled = order.status === 'Cancelled';
  const idx = isCancelled ? -1 : STAGES.indexOf(order.status);
  const late = order.minutesLate > 0 && !['Ready', 'Handed over', 'Cancelled'].includes(order.status);

  const stageTime = (s) => {
    if (s === 'Placed') return order.created_at;
    const e = (order.events || []).find((ev) => (ev.to_status || ev.status) === s);
    return e ? e.created_at : null;
  };

  const promised = new Date(order.promised_at);
  const remaining = Math.max(0, Math.round((promised - now) / 60000));
  const handedAt = stageTime('Handed over');

  const headline = isCancelled ? 'Order Cancelled'
    : order.status === 'Handed over' ? `Delivered at ${handedAt ? new Date(handedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : fmtTime(order.promised_at)}`
    : order.status === 'Ready' ? 'Ready for pickup'
    : late ? `Running late by ${order.minutesLate} min`
    : `Arriving in ~${remaining} min`;

  const updates = (order.events || [])
    .map((e) => ({ at: e.created_at, text: stageSentence(e.to_status || e.status) }))
    .filter((u) => u.text);

  return (
    <div className="order-detail-page" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Back button */}
      <button
        type="button"
        className="btn btn-sec btn-sm"
        style={{ marginBottom: 16 }}
        onClick={onBack}
      >
        ← Back to all orders
      </button>

      {/* Main Status Header Card */}
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">{order.outlet_name} · {order.payment_method} · #{order.order_no}</div>
            <h1 className="serif" style={{ fontSize: 32, margin: '4px 0 6px' }}>{headline}</h1>
            <p className="small muted" style={{ margin: 0 }}>
              Promised by {fmtTime(order.promised_at)} · {order.outlet_name} Outlet
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="price" style={{ fontSize: 20 }}>{fmt(order.payable)}</span>
            <div style={{ marginTop: 6 }}><StatusBadge status={order.status} /></div>
          </div>
        </div>

        {order.delivery_address && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#F8F7F4', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
            <span className="small muted" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Delivery Address</span>
            <strong style={{ fontSize: 13.5 }}>{order.delivery_address}</strong>
          </div>
        )}

        {late && (
          <div className="banner late" style={{ marginTop: 12 }}>
            <strong>Running late — kitchen is on it.</strong> Outlet manager has been alerted.
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 14 }}>Tracking Timeline</h3>
        <div className="order-timeline-clean">
          {STAGES.map((s, i) => {
            const done = !isCancelled && i <= idx;
            const current = !isCancelled && i === idx;
            const at = stageTime(s);
            return (
              <div key={s} className={`timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                <div className="step-indicator">
                  {done ? '✓' : i + 1}
                </div>
                <div className="step-info">
                  <div className="step-title">
                    <strong>{s}</strong>
                    {current && <span className="step-now-badge">Now</span>}
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
        {isCancelled && <p className="small muted" style={{ marginTop: 8 }}>This order was cancelled.</p>}
      </div>

      {/* Items List (Clean compact rows, NO giant images!) */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 10 }}>Order Summary</h3>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {order.items.map((it, i) => (
            <div key={i} className="order-item-compact-row">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 14.5 }}>{it.item_name}</strong>
                  <span className="small muted">× {it.qty}</span>
                </div>
                {[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).length > 0 && (
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span className="price" style={{ fontSize: 14 }}>{fmt(it.unit_price * it.qty)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bill Breakdown */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 10 }}>Bill Receipt</h3>
        <div className="bill-row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
        {order.coupon_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Coupon Discount</span><span>−{fmt(order.coupon_off)}</span></div> : null}
        {order.loyalty_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Loyalty Points Discount</span><span>−{fmt(order.loyalty_off)}</span></div> : null}
        <div className="bill-row"><span className="muted">GST (5%, Included)</span><span className="muted">{fmt(order.gst_amount)}</span></div>
        <div className="bill-row total"><span>Total Amount Paid</span><span>{fmt(order.payable)}</span></div>

        {(order.points_earned > 0 || order.points_used > 0) && (
          <p className="small muted" style={{ marginTop: 10, padding: '8px 12px', background: '#F8F7F4', borderRadius: 'var(--r)' }}>
            {order.points_earned > 0 ? `+${order.points_earned} loyalty points earned on this order. ` : ''}
            {order.points_used > 0 ? `${order.points_used} points redeemed.` : ''}
          </p>
        )}
      </div>

      {/* Notification Activity */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 8 }}>Order Updates</h3>
        {updates.length === 0 ? (
          <p className="small muted">Updates will show here in real-time as kitchen status changes.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}

// ── Main Orders List Page ──
export default function TrackPage({ user, socketRef }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [activeOrder, setActiveOrder] = useState(null); // When set, shows order detail view
  const [ledger, setLedger] = useState([]);
  const [myParties, setMyParties] = useState([]);
  const [optIn, setOptIn] = useState(!!user?.marketing_opt_in);

  useEffect(() => {
    api('/api/loyalty/history').then(setLedger).catch(() => {});
    api('/api/party/mine').then(setMyParties).catch(() => {});
  }, []);

  const toggleOptIn = async (v) => {
    setOptIn(v);
    try { await api('/api/auth/me', { method: 'PATCH', body: { marketing_opt_in: v } }); }
    catch { setOptIn(!v); }
  };

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const o = await api('/api/orders/mine');
      setOrders(o);
      // Keep activeOrder synced if user is viewing one
      if (activeOrder) {
        const found = o.find((x) => x.order_no === activeOrder.order_no);
        if (found) setActiveOrder(found);
      }
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const s = socketRef.current; if (!s) return;
    const h = (o) => {
      setOrders((prev) => prev.map((x) => x.order_no === o.order_no ? o : x));
      setActiveOrder((prev) => prev && prev.order_no === o.order_no ? o : prev);
    };
    const onConnect = () => { load(); orders.forEach((o) => s.emit('join-order', o.order_no)); };
    s.on('order:updated', h);
    s.on('connect', onConnect);
    orders.forEach((o) => s.emit('join-order', o.order_no));
    return () => { s.off('order:updated', h); s.off('connect', onConnect); };
  }, [orders.length]);

  if (!user) return (
    <div className="card" style={{ marginTop: 24, maxWidth: 480, margin: '32px auto' }}>
      Please sign in to view your orders.
    </div>
  );

  // If viewing a specific order's details, show full drill-down screen
  if (activeOrder) {
    return (
      <section style={{ marginTop: 24 }}>
        <OrderDetailView order={activeOrder} onBack={() => setActiveOrder(null)} />
      </section>
    );
  }

  // Otherwise, show clean list of all orders
  return (
    <section style={{ marginTop: 24, maxWidth: 840, margin: '24px auto' }}>
      <div className="eyebrow">Customer Account</div>
      <h1 className="serif" style={{ fontSize: 36, margin: '6px 0 20px' }}>My Orders</h1>
      <Err msg={err} retry={load} />

      {loading ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 6 }} />
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <h2 className="serif" style={{ fontSize: 24 }}>No orders placed yet</h2>
          <p className="muted">Your fresh Hyderabadi biryani is waiting on the menu.</p>
        </div>
      ) : (
        <div className="orders-clean-list">
          {orders.map((o) => (
            <div
              key={o.order_no}
              className="order-card-row"
              onClick={() => setActiveOrder(o)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveOrder(o); }}
            >
              <div className="order-card-row-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 16 }}>{o.outlet_name} Outlet</strong>
                  <StatusBadge status={o.status} />
                </div>

                <div className="small muted" style={{ marginTop: 4 }}>
                  Order #{o.order_no} · {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </div>

                <div className="order-items-snippet" style={{ marginTop: 6 }}>
                  {o.items.map((it) => `${it.item_name} (×${it.qty})`).join(', ')}
                </div>
              </div>

              <div className="order-card-row-action">
                <div className="price" style={{ fontSize: 16 }}>{fmt(o.payable)}</div>
                <button type="button" className="btn btn-sec btn-sm" style={{ marginTop: 8 }}>
                  View Details →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loyalty points card */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0, fontSize: 17 }}>Loyalty Points Balance</h3>
        <p className="small" style={{ marginBottom: 10 }}>
          Available: <strong>{user.points} points</strong> · Earn 1 pt per ₹20 spent (100 pts = ₹50 discount).
        </p>
        {ledger.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="table">
              <thead><tr><th>Points Change</th><th>Reason</th><th>Date</th></tr></thead>
              <tbody>
                {ledger.slice(0, 5).map((l) => (
                  <tr key={l.id}>
                    <td style={{ color: l.delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </td>
                    <td>{l.reason}</td>
                    <td>{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12, fontSize: 12.5 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={optIn} onChange={(e) => toggleOptIn(e.target.checked)} />
          Receive transactional order updates & promotional messages (DPDP Act 2023)
        </label>
      </div>

      {/* Party enquiries card */}
      {myParties.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 17 }}>My Party Order Enquiries</h3>
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="table">
              <thead><tr><th>Outlet</th><th>Event Date</th><th>Guests</th><th>Status</th></tr></thead>
              <tbody>
                {myParties.map((pp) => (
                  <tr key={pp.id}>
                    <td><strong>{pp.outlet_name}</strong></td>
                    <td>{new Date(pp.event_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td>{pp.guests} guests</td>
                    <td><span className="tag">{pp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
