// TrackPage.jsx — order history + live tracking with clean distinct cards
import { useState, useEffect } from 'react';
import { api, fmt, fmtTime } from '../api.js';
import { Err, ItemThumb, StatusBadge } from '../components/Common.jsx';

const STAGES = ['Placed', 'Preparing', 'Ready', 'Rider handoff', 'Handed over'];

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function stageSentence(s) {
  return {
    Placed: 'Order placed & sent to kitchen',
    Preparing: 'Kitchen preparing your order',
    Ready: 'Food packed & ready for pickup',
    'Rider handoff': 'Rider picked up order',
    'Handed over': 'Delivered successfully',
    Cancelled: 'Order cancelled',
  }[s] || s;
}

function OrderDetail({ o }) {
  const now = useNow(30000);
  const isCancelled = o.status === 'Cancelled';
  const idx = isCancelled ? -1 : STAGES.indexOf(o.status);
  const late = o.minutesLate > 0 && !['Ready', 'Handed over', 'Cancelled'].includes(o.status);

  const stageTime = (s) => {
    if (s === 'Placed') return o.created_at;
    const e = (o.events || []).find((ev) => (ev.to_status || ev.status) === s);
    return e ? e.created_at : null;
  };

  const promised = new Date(o.promised_at);
  const remaining = Math.max(0, Math.round((promised - now) / 60000));
  const handedAt = stageTime('Handed over');

  const headline = isCancelled ? 'Order Cancelled'
    : o.status === 'Handed over' ? `Delivered at ${handedAt ? new Date(handedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : fmtTime(o.promised_at)}`
    : o.status === 'Ready' ? 'Ready for pickup'
    : late ? `Running late by ${o.minutesLate} min`
    : `Arriving in ~${remaining} min`;

  const updates = (o.events || [])
    .map((e) => ({ at: e.created_at, text: stageSentence(e.to_status || e.status) }))
    .filter((u) => u.text);

  return (
    <div className="order-detail-container">
      {/* Header status card */}
      <div className="card">
        <div className="eyebrow">{o.outlet_name} · {o.payment_method} · {o.order_no}</div>
        <h2 className="serif" style={{ fontSize: 28, margin: '6px 0 4px' }}>{headline}</h2>
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Promised by {fmtTime(o.promised_at)} · {o.outlet_name} Outlet
        </p>
        <StatusBadge status={o.status} />
        {o.delivery_address && (
          <p className="small" style={{ marginTop: 12, padding: '8px 10px', background: '#F8F7F4', border: '1px solid var(--line)' }}>
            Delivery Address: <strong>{o.delivery_address}</strong>
          </p>
        )}
        {late && (
          <div className="banner late" style={{ marginTop: 12 }}>
            <strong>Running late — kitchen is on it.</strong> The outlet manager has been notified.
          </div>
        )}
      </div>

      {/* Timeline Steps */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 14 }}>Order Status Progress</h3>
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
                    {current && <span className="step-now-badge">Current</span>}
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
        {isCancelled && <p className="small muted" style={{ marginTop: 10 }}>This order was cancelled.</p>}
      </div>

      {/* Items list */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 12 }}>Items in this order</h3>
        {o.items.map((it, i) => (
          <div key={i} className="order-item-row">
            <ItemThumb photo={it.photo} name={it.item_name} />
            <div className="order-item-main">
              <strong>{it.item_name}</strong>
              <span className="small muted">{[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="small muted" style={{ marginRight: 12 }}>× {it.qty}</span>
            <span className="price">{fmt(it.unit_price * it.qty)}</span>
          </div>
        ))}
      </div>

      {/* Bill summary */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 12 }}>Payment Details</h3>
        <div className="bill-row"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
        {o.coupon_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Coupon Discount</span><span>−{fmt(o.coupon_off)}</span></div> : null}
        {o.loyalty_off ? <div className="bill-row" style={{ color: 'var(--green)' }}><span>Loyalty Points Discount</span><span>−{fmt(o.loyalty_off)}</span></div> : null}
        <div className="bill-row"><span className="muted">GST 5% (Included)</span><span className="muted">{fmt(o.gst_amount)}</span></div>
        <div className="bill-row total"><span>Total Paid</span><span>{fmt(o.payable)}</span></div>

        {(o.points_earned > 0 || o.points_used > 0) && (
          <p className="small muted" style={{ marginTop: 10, padding: '8px 10px', background: '#F8F7F4' }}>
            {o.points_earned > 0 ? `+${o.points_earned} loyalty points earned on this order. ` : ''}
            {o.points_used > 0 ? `${o.points_used} points redeemed.` : ''}
          </p>
        )}
      </div>

      {/* Updates log */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 8 }}>Notification Log</h3>
        <p className="small muted" style={{ marginTop: 0, marginBottom: 10 }}>
          Transactional order updates sent automatically (mocked in demo).
        </p>
        {updates.length === 0 ? (
          <p className="small muted">Order just placed — updates will log here.</p>
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

export default function TrackPage({ user, socketRef }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState(null);
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
      if (o[0]) setSelected(o[0]);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const s = socketRef.current; if (!s) return;
    const h = (o) => {
      setOrders((prev) => prev.map((x) => x.order_no === o.order_no ? o : x));
      setSelected((prev) => prev && prev.order_no === o.order_no ? o : prev);
    };
    const onConnect = () => { load(); orders.forEach((o) => s.emit('join-order', o.order_no)); };
    s.on('order:updated', h);
    s.on('connect', onConnect);
    orders.forEach((o) => s.emit('join-order', o.order_no));
    return () => { s.off('order:updated', h); s.off('connect', onConnect); };
  }, [orders.length]);

  if (!user) return (
    <div className="card" style={{ marginTop: 24 }}>Please sign in to view your orders.</div>
  );

  return (
    <section style={{ marginTop: 24 }}>
      <div className="eyebrow">Customer Dashboard</div>
      <h1 className="serif" style={{ fontSize: 36, margin: '6px 0 20px' }}>Your orders</h1>
      <Err msg={err} retry={load} />

      {loading ? (
        <div className="skeleton" style={{ height: 100, borderRadius: 4 }} />
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <h2 className="serif" style={{ fontSize: 24 }}>No orders placed yet.</h2>
          <p className="muted">Your fresh Hyderabadi biryani is waiting on the menu.</p>
        </div>
      ) : (
        <div className="orders-page-layout">
          {/* Order list column */}
          <div className="orders-sidebar-col">
            <div className="order-cards-stack">
              {orders.map((o) => (
                <div
                  key={o.order_no}
                  className={`order-list-card ${selected?.order_no === o.order_no ? 'active' : ''}`}
                  onClick={() => setSelected(o)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelected(o); }}
                >
                  <div className="order-card-header">
                    <span className="order-card-outlet">{o.outlet_name}</span>
                    <span className="price">{fmt(o.payable)}</span>
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {o.order_no}
                  </div>
                  <div className="small" style={{ marginTop: 6, color: '#333' }}>
                    {o.items.map((it) => `${it.item_name} ×${it.qty}`).join(', ')}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>

            {/* Loyalty points card */}
            <div className="card" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>Loyalty points balance</h3>
              <p className="small">
                Balance: <strong>{user.points} points</strong><br />
                <span className="muted">Earn 1 pt per ₹20 spent · 100 pts = ₹50 discount</span>
              </p>
              {ledger.length > 0 && (
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="table">
                    <thead><tr><th>Change</th><th>Reason</th><th>Date</th></tr></thead>
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
                Opt in to promotional WhatsApp/SMS (DPDP Act 2023)
              </label>
            </div>

            {/* Party enquiries card */}
            {myParties.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Party order bookings</h3>
                <div className="table-scroll">
                  <table className="table">
                    <thead><tr><th>Outlet</th><th>Event Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {myParties.map((pp) => (
                        <tr key={pp.id}>
                          <td><strong>{pp.outlet_name}</strong></td>
                          <td>{new Date(pp.event_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td><span className="tag">{pp.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Selected Order Detail column */}
          <div className="orders-main-col">
            {selected && <OrderDetail o={selected} />}
          </div>
        </div>
      )}
    </section>
  );
}
