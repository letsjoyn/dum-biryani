// KitchenPage.jsx — Kitchen Display System
import { useState, useEffect } from 'react';
import { api, fmt, fmtTime, setToken } from '../api.js';
import { Err } from '../components/Common.jsx';

function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const nextStage = (o) => ({ Placed: 'Preparing', Preparing: 'Ready', Ready: 'Rider handoff', 'Rider handoff': 'Handed over' }[o.status]);
const stageLabel = (s) => ({ Placed: 'New order', Preparing: 'Preparing', Ready: 'Ready for pickup', 'Rider handoff': 'Rider handoff', 'Handed over': 'Handed over' }[s] || s);

export default function KitchenPage({ user, setUser, outlets, socketRef, onBack, backLabel }) {
  const [outletId, setOutletId] = useState(user.role === 'kitchen' ? user.outlet_id : 1);
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState([]);
  const [override, setOverride] = useState({});
  const now = useNow(15000);

  const load = async () => {
    setErr('');
    try {
      const q = user.role === 'manager' ? `?outletId=${outletId}` : '';
      setOrders(await api(`/api/kitchen/orders${q}`));
      const m = await api(`/api/menu?outletId=${user.role === 'kitchen' ? user.outlet_id : outletId}`, { auth: false });
      setMenu(m);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, [outletId]);

  useEffect(() => {
    const s = socketRef.current; if (!s) return;
    const target = user.role === 'kitchen' ? user.outlet_id : outletId;
    const join = () => s.emit('join-outlet', target);
    join();
    const onConnect = () => { join(); load(); };
    s.on('connect', onConnect);
    const onCreated = (o) => { if (o.outlet_id !== target) return; setOrders((prev) => prev.some((x) => x.id === o.id) ? prev : [o, ...prev]); };
    const onUpdated = (o) => { if (o.outlet_id !== target) return; setOrders((prev) => prev.map((x) => x.id === o.id ? o : x).filter((x) => x.status !== 'Handed over' && x.status !== 'Cancelled')); };
    s.on('order:created', onCreated); s.on('order:updated', onUpdated);
    return () => { s.emit('leave-outlet', target); s.off('order:created', onCreated); s.off('order:updated', onUpdated); s.off('connect', onConnect); };
  }, [outletId]);

  const outlet = outlets.find((o) => o.id === (user.role === 'kitchen' ? user.outlet_id : outletId));
  const lateFor = (o) => ['Placed', 'Preparing'].includes(o.status) ? Math.max(0, Math.floor((now - new Date(o.promised_at)) / 60000)) : 0;
  const lateAlerts = orders.filter((o) => lateFor(o) >= 10);

  const move = async (o, status) => {
    try { await api(`/api/kitchen/orders/${o.id}/status`, { method: 'PATCH', body: { status } }); load(); }
    catch (e) { setErr(e.message); }
  };
  const doOverride = async (o) => {
    const mins = Number(override[o.id]);
    if (!mins) return;
    try { await api(`/api/kitchen/orders/${o.id}/promise`, { method: 'PATCH', body: { minutes: mins } }); load(); }
    catch (e) { setErr(e.message); }
  };
  const toggleStock = async (item, out) => {
    try { await api(`/api/kitchen/items/${item.id}/outlet/${user.role === 'kitchen' ? user.outlet_id : outletId}/stock`, { method: 'PATCH', body: { outOfStock: out } }); load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="kds">
      {/* Header */}
      <div className="kds-header">
        <div>
          <div className="kds-title">Kitchen Display · Live</div>
          <h1>{outlet?.name || 'Kitchen'}</h1>
          <p className="kds-sub">FSSAI {outlet?.fssai} · {user.name} · {user.role}</p>
        </div>
        <div className="kds-actions">
          {user.role === 'manager' && (
            <div className="kds-outlet-tabs">
              {outlets.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={o.id === outletId ? 'kbtn' : 'kbtn kbtn-sec'}
                  aria-pressed={o.id === outletId}
                  onClick={() => setOutletId(o.id)}
                >
                  {o.name}
                </button>
              ))}
            </div>
          )}
          {onBack && <button className="kbtn kbtn-sec" onClick={onBack}>{backLabel || 'Back'}</button>}
          <button className="kbtn kbtn-sec" onClick={load}>Refresh</button>
          <button className="kbtn kbtn-sec" onClick={() => { setToken(null); setUser(null); }}>Sign out</button>
        </div>
      </div>

      <div className="kds-body">
        {/* Alert banner */}
        {lateAlerts.length > 0 && (
          <div className="kds-alert">
            MANAGER ALERT — {lateAlerts.length} order{lateAlerts.length > 1 ? 's' : ''} 10+ min past promise:{' '}
            {lateAlerts.map((o) => o.order_no).join(', ')}
          </div>
        )}

        {err && (
          <div style={{ background: '#7F1D1D', color: '#fff', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
            {err} <button onClick={load} style={{ marginLeft: 12, background: 'none', border: '1px solid #fff', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Order cards */}
        {orders.length === 0 ? (
          <div className="kds-card" style={{ marginTop: 0, textAlign: 'center', padding: 32 }}>
            <h2 style={{ fontSize: 24, margin: '8px 0' }}>No active orders</h2>
            <p style={{ color: '#666' }}>New orders appear here instantly — no refresh needed.</p>
          </div>
        ) : (
          <div className="kds-grid">
            {orders.map((o) => {
              const elapsed = Math.max(0, Math.floor((now - new Date(o.created_at)) / 60000));
              const late = lateFor(o) > 0;
              const minutesLate = lateFor(o);
              const remaining = Math.max(0, Math.round((new Date(o.promised_at) - now) / 60000));
              const isReady = o.status === 'Ready';
              const isNew = o.status === 'Placed';

              const statusText = isReady ? 'READY — for pickup'
                : late ? `LATE by ${minutesLate} min`
                  : isNew ? `NEW · ${remaining} min`
                    : `${remaining} min remaining`;

              const statusClass = isReady ? 'ok' : late ? 'late' : isNew ? 'placed' : 'preparing';

              return (
                <div key={o.id} className={`kds-card ${late ? 'late' : ''} ${isReady ? 'ready' : ''}`}>
                  <div className="kds-card-top">
                    <span className="kds-order-no">{o.order_no}</span>
                    <span className="timer">{elapsed}m elapsed</span>
                  </div>

                  <div className={`kds-status ${statusClass}`}>{statusText}</div>

                  <div className="big" style={{ color: '#ccc' }}>
                    {stageLabel(o.status).toUpperCase()} · {o.payment_method} · {fmt(o.payable)}
                  </div>

                  {/* Items — large text, readable from 2m */}
                  <div>
                    {o.items.map((it, i) => (
                      <div key={i} className="kds-item">
                        <strong>×{it.qty}</strong> {it.item_name}
                        {it.portion ? ` — ${it.portion}` : ''}
                        {it.addons.length ? ` + ${it.addons.join(', ')}` : ''}
                      </div>
                    ))}
                  </div>

                  {o.delivery_address && (
                    <div className="kds-address">Delivery: {o.delivery_address}</div>
                  )}

                  <div className={`kds-promise ${late ? 'late' : ''}`}>
                    Promised {fmtTime(o.promised_at)}
                    {late ? ` · LATE by ${minutesLate} min` : ''}
                    {' '}· Est {o.estimate?.promised || o.estimate_minutes} min
                    (base {o.estimate?.base} + queue {o.estimate?.queueLoad})
                  </div>

                  {nextStage(o) && (
                    <button
                      className="kbtn"
                      style={{ width: '100%', marginTop: 4, fontSize: 16 }}
                      onClick={() => move(o, nextStage(o))}
                    >
                      Mark {stageLabel(nextStage(o))} →
                    </button>
                  )}

                  {/* Manager override */}
                  {user.role === 'manager' && (
                    <div style={{ marginTop: 10, borderTop: '1px solid #2A2A2A', paddingTop: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[15, 30, 45, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className="kbtn kbtn-sec"
                            style={{ fontSize: 13, padding: '8px 12px', minHeight: 40 }}
                            onClick={() => setOverride({ ...override, [o.id]: String(m) })}
                          >
                            +{m} min
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          aria-label="Override promised minutes"
                          type="number"
                          min="5"
                          max="240"
                          placeholder="Custom mins"
                          value={override[o.id] || ''}
                          onChange={(e) => setOverride({ ...override, [o.id]: e.target.value })}
                          style={{ background: '#262626', color: '#fff', borderColor: '#444', flex: 1 }}
                        />
                        <button className="kbtn kbtn-sec" style={{ whiteSpace: 'nowrap' }} onClick={() => doOverride(o)}>
                          Override
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Out of stock */}
        <div className="kds-stock">
          <h2>Pause items at this outlet</h2>
          <p>Paused items disappear from the customer menu for this outlet only — restored instantly.</p>
          <div className="kds-stock-grid">
            {menu.map((m) => (
              <button
                key={m.id}
                className={`kbtn ${m.outOfStock ? 'kbtn-sec' : ''}`}
                style={{ fontSize: 15, padding: '12px 16px', minHeight: 50 }}
                onClick={() => toggleStock(m, !m.outOfStock)}
              >
                {m.name}{' '}
                <span style={{ opacity: .7, fontSize: 13 }}>
                  {m.outOfStock ? '— Paused · tap to restore' : '— Live · tap to pause'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

