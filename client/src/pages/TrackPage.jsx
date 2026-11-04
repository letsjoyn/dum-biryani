// TrackPage.jsx — order history + live tracking
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
  return { Placed: 'Order placed', Preparing: 'Kitchen started', Ready: 'Ready for pickup', 'Rider handoff': 'Rider picked up', 'Handed over': 'Order delivered', Cancelled: 'Order cancelled' }[s] || s;
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

  const headline = isCancelled ? 'Cancelled'
    : o.status === 'Handed over' ? `Delivered at ${handedAt ? new Date(handedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : fmtTime(o.promised_at)}`
    : o.status === 'Ready' ? 'Ready for pickup'
    : late ? `Running late by ${o.minutesLate} min`
    : `Arriving in ~${remaining} min`;

  const updates = (o.events || [])
    .map((e) => ({ at: e.created_at, text: stageSentence(e.to_status || e.status) }))
    .filter((u) => u.text);

  return (
    <div>
      {/* Status card */}
      <div className="card">
        <div className="eyebrow">{o.outlet_name} · {o.payment_method} · {o.order_no}</div>
        <h2 className="serif" style={{ fontSize: 28, margin: '6px 0 4px' }}>{headline}</h2>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Promised by {fmtTime(o.promised_at)} · {o.outlet_name}
        </p>
        <StatusBadge status={o.status} />
        {o.delivery_address && (
          <p className="small" style={{ marginTop: 10 }}>
            Delivering to: <strong>{o.delivery_address}</strong>
          </p>
        )}
        {late && (
          <div className="banner late" style={{ marginTop: 12 }}>
            <strong>Running late — we're on it.</strong> The outlet manager has been alerted.
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Where is your order?</h3>
        <div className="timeline-v">
          {STAGES.map((s, i) => {
            const done = !isCancelled && i <= idx;
            const current = !isCancelled && i === idx;
            const at = stageTime(s);
            return (
              <div key={s} className={`tl-row ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                <span className="tl-dot">{done ? '✓' : ''}</span>
                <span className="tl-text">
                  <strong>{s}</strong>
                  {current && <span className="tl-now"> · Now</span>}
                  {at && <span className="small muted"> · {new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>}
                </span>
              </div>
            );
          })}
        </div>
        {isCancelled && <p className="small muted" style={{ marginTop: 8 }}>This order was cancelled.</p>}
      </div>

      {/* Items */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Your items</h3>
        {o.items.map((it, i) => (
          <div key={i} className="order-item-row">
            <ItemThumb photo={it.photo} name={it.item_name} />
            <span className="order-item-main">
              <strong>{it.item_name}</strong>
              <span className="small muted">{[it.portion, it.addons.length ? it.addons.join(', ') : ''].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="small muted">× {it.qty}</span>
            <span className="price">{fmt(it.unit_price * it.qty)}</span>
          </div>
        ))}
      </div>

      {/* Bill */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Bill</h3>
        <div className="bill-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }}>
          <span>Subtotal</span><span>{fmt(o.subtotal)}</span>
        </div>
        {o.coupon_off ? <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }}><span>Coupon</span><span>−{fmt(o.coupon_off)}</span></div> : null}
        {o.loyalty_off ? <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }}><span>Loyalty</span><span>−{fmt(o.loyalty_off)}</span></div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14, color: '#6B6B6B' }}><span>GST 5% (included)</span><span>{fmt(o.gst_amount)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #E7E5E0', paddingTop: 10, marginTop: 4, fontSize: 16 }}>
          <span>Total paid</span><span>{fmt(o.payable)}</span>
        </div>
        {(o.points_earned > 0 || o.points_used > 0) && (
          <p className="small muted" style={{ marginTop: 6 }}>
            {o.points_earned > 0 ? `+${o.points_earned} loyalty points earned. ` : ''}
            {o.points_used > 0 ? `${o.points_used} points used.` : ''}
          </p>
        )}
        <details style={{ marginTop: 8 }}>
          <summary className="small">How we estimated this</summary>
          <p className="small muted" style={{ marginTop: 6 }}>
            Base {o.estimate?.base ?? o.estimate_minutes} min + queue {o.estimate?.queueLoad ?? 0} min = {o.estimate?.total ?? o.estimate_minutes} min, promised {o.estimate?.promised ?? o.estimate_minutes} min.
            {o.promise_override ? ` Manager override: ${o.promise_override} min.` : ''}
          </p>
        </details>
      </div>

      {/* Updates */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Updates</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Demo: WhatsApp/SMS sending is mocked. Live updates arrive without refresh.
        </p>
        {updates.length === 0
          ? <p className="small muted">No updates yet.</p>
          : (
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
    try { const o = await api('/api/orders/mine'); setOrders(o); if (o[0]) setSelected(o[0]); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
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
    <div className="card" style={{ marginTop: 24 }}>Please sign in to see your orders.</div>
  );

  return (
    <section style={{ marginTop: 24 }}>
      <div className="eyebrow">Live tracking</div>
      <h1 className="serif" style={{ fontSize: 36, margin: '8px 0 20px' }}>Your orders</h1>
      <Err msg={err} retry={load} />

      {loading ? (
        <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <h2 className="serif" style={{ fontSize: 24 }}>No orders yet.</h2>
          <p className="muted">Your first biryani is waiting on the menu.</p>
        </div>
      ) : (
        <div className="orders-layout">
          {/* Order list sidebar */}
          <div>
            <div className="order-list">
              {orders.map((o) => (
                <button
                  key={o.order_no}
                  type="button"
                  className={`order-card ${selected?.order_no === o.order_no ? 'on' : ''}`}
                  onClick={() => setSelected(o)}
                  aria-pressed={selected?.order_no === o.order_no}
                >
                  <span className="order-card-main">
                    <strong>{o.outlet_name}</strong>
                    <span className="small muted">
                      {new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {o.order_no}
                    </span>
                    <span className="small">
                      {o.items.map((it) => `${it.item_name} ×${it.qty}`).slice(0, 2).join(', ')}
                      {o.items.length > 2 ? ` +${o.items.length - 2} more` : ''}
                    </span>
                  </span>
                  <span className="order-card-side">
                    <span className="price">{fmt(o.payable)}</span>
                    <StatusBadge status={o.status} />
                  </span>
                </button>
              ))}
            </div>

            {/* Loyalty points */}
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>Loyalty points</h3>
              <p className="small">
                Balance: <strong>{user.points} points</strong><br />
                <span className="muted">1 pt per ₹20 · 100 pts = ₹50 off</span>
              </p>
              {ledger.length > 0 && (
                <div className="table-scroll" style={{ marginTop: 8 }}>
                  <table className="table">
                    <thead><tr><th>Change</th><th>Reason</th><th>When</th></tr></thead>
                    <tbody>
                      {ledger.slice(0, 5).map((l) => (
                        <tr key={l.id}>
                          <td style={{ color: l.delta > 0 ? '#1A7F37' : '#C2410C' }}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                          <td>{l.reason}</td>
                          <td>{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 10, fontSize: 13 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={optIn} onChange={(e) => toggleOptIn(e.target.checked)} />
                Marketing messages opt-in (DPDP Act 2023)
              </label>
            </div>

            {/* Party enquiries */}
            {myParties.length > 0 && (
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>My party enquiries</h3>
                <div className="table-scroll">
                  <table className="table">
                    <thead><tr><th>Outlet</th><th>When</th><th>Status</th></tr></thead>
                    <tbody>
                      {myParties.map((pp) => (
                        <tr key={pp.id}>
                          <td>{pp.outlet_name}</td>
                          <td>{new Date(pp.event_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td>{pp.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Order detail */}
          <div>
            {selected && <OrderDetail o={selected} />}
          </div>
        </div>
      )}
    </section>
  );
}
