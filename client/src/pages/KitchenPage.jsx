// KitchenPage.jsx — Commercial Grade Kitchen Display System (Readable from 2m, fast touch targets)
import { useState, useEffect } from 'react';
import { api, fmt, fmtTime, setToken } from '../api.js';

function useNow(ms = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const nextStage = (o) => ({
  Placed: 'Preparing',
  Preparing: 'Ready',
  Ready: 'Rider handoff',
  'Rider handoff': 'Handed over',
}[o.status]);

const stageActionText = (s) => ({
  Placed: 'Start Cooking →',
  Preparing: 'Mark Ready for Pickup ✓',
  Ready: 'Handover to Rider 🛵',
  'Rider handoff': 'Complete Order ✓',
}[s] || `Mark ${s} →`);

export default function KitchenPage({ user, setUser, outlets, socketRef, onBack, backLabel, onSignOut }) {
  const [outletId, setOutletId] = useState(user.role === 'kitchen' ? user.outlet_id : (outlets[0]?.id || null));
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState([]);
  const [override, setOverride] = useState({});
  const [showOverride, setShowOverride] = useState({});
  const [overrideNotice, setOverrideNotice] = useState({});
  const now = useNow(5000);

  useEffect(() => {
    if (user.role !== 'kitchen' && outlets.length > 0 && (!outletId || !outlets.some((o) => o.id === outletId))) {
      setOutletId(outlets[0].id);
    }
  }, [outlets, outletId, user]);

  const load = async () => {
    setErr('');
    try {
      const target = user.role === 'kitchen' ? user.outlet_id : outletId;
      const q = user.role === 'manager' ? `?outletId=${outletId}` : '';
      setOrders(await api(`/api/kitchen/orders${q}`));
      const m = await api(`/api/menu?outletId=${target}`, { auth: false });
      setMenu(m);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, [outletId]);

  useEffect(() => {
    const s = socketRef?.current; if (!s) return;
    const target = user.role === 'kitchen' ? user.outlet_id : outletId;
    const join = () => s.emit('join-outlet', target);
    join();
    const onConnect = () => { join(); load(); };
    s.on('connect', onConnect);
    const onCreated = (o) => {
      if (Number(o.outlet_id) !== Number(target)) return;
      setOrders((prev) => prev.some((x) => x.id === o.id) ? prev : [o, ...prev]);
    };
    const onUpdated = (o) => {
      if (Number(o.outlet_id) !== Number(target)) return;
      setOrders((prev) => prev.map((x) => x.id === o.id ? o : x).filter((x) => x.status !== 'Handed over' && x.status !== 'Cancelled'));
    };
    const onMenuUpdated = () => { load(); };

    s.on('order:created', onCreated);
    s.on('order:updated', onUpdated);
    s.on('menu:updated', onMenuUpdated);
    return () => {
      s.emit('leave-outlet', target);
      s.off('order:created', onCreated);
      s.off('order:updated', onUpdated);
      s.off('menu:updated', onMenuUpdated);
      s.off('connect', onConnect);
    };
  }, [outletId, socketRef]);

  const outlet = outlets.find((o) => o.id === (user.role === 'kitchen' ? user.outlet_id : outletId));
  const lateFor = (o) => ['Placed', 'Preparing'].includes(o.status)
    ? Math.max(0, Math.floor((now - new Date(o.promised_at)) / 60000))
    : 0;

  const lateAlerts = orders.filter((o) => lateFor(o) >= 10);
  const preparingCount = orders.filter((o) => o.status === 'Preparing').length;
  const readyCount = orders.filter((o) => o.status === 'Ready').length;
  const newCount = orders.filter((o) => o.status === 'Placed').length;

  const move = async (o, status) => {
    try {
      await api(`/api/kitchen/orders/${o.id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) { setErr(e.message); }
  };

  const doOverride = async (o, customMins) => {
    const mins = Number(customMins || override[o.id]);
    if (!mins) return;
    try {
      await api(`/api/kitchen/orders/${o.id}/promise`, { method: 'PATCH', body: { minutes: mins } });
      setOverrideNotice({ ...overrideNotice, [o.id]: `Updated promised prep time to ${mins} mins` });
      setTimeout(() => {
        setOverrideNotice((prev) => ({ ...prev, [o.id]: '' }));
      }, 4000);
      load();
    } catch (e) { setErr(e.message); }
  };

  const toggleStock = async (item, out) => {
    try {
      await api(`/api/kitchen/items/${item.id}/outlet/${user.role === 'kitchen' ? user.outlet_id : outletId}/stock`, {
        method: 'PATCH',
        body: { outOfStock: out },
      });
      load();
    } catch (e) { setErr(e.message); }
  };

  const currentTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }).format(new Date(now));

  return (
    <div className="kds-system-root">
      {/* ── KDS Top Bar ── */}
      <header className="kds-topbar-pro">
        <div className="kds-topbar-left">
          <div className="kds-badge-pill">KDS LIVE · HYDERABAD</div>
          <div className="kds-outlet-heading-wrap">
            <h1 className="kds-station-title">{outlet?.name || 'Kitchen Hub'}</h1>
            <span className="kds-station-sub">FSSAI {outlet?.fssai || '10124012001201'} · Staff: {user.name} ({user.role})</span>
          </div>
        </div>

        {/* Live Counters */}
        <div className="kds-metrics-cluster">
          <div className="kds-metric-item">
            <span className="kds-metric-val" style={{ color: '#FBBF24' }}>{newCount}</span>
            <span className="kds-metric-lbl">NEW</span>
          </div>
          <div className="kds-metric-item">
            <span className="kds-metric-val" style={{ color: '#38BDF8' }}>{preparingCount}</span>
            <span className="kds-metric-lbl">PREPARING</span>
          </div>
          <div className="kds-metric-item">
            <span className="kds-metric-val" style={{ color: '#34D399' }}>{readyCount}</span>
            <span className="kds-metric-lbl">READY</span>
          </div>
          {lateAlerts.length > 0 && (
            <div className="kds-metric-item late-glow">
              <span className="kds-metric-val" style={{ color: '#F87171' }}>{lateAlerts.length}</span>
              <span className="kds-metric-lbl">10M+ LATE</span>
            </div>
          )}
          <div className="kds-clock-box">
            <span className="kds-clock-text">{currentTimeStr}</span>
            <span className="kds-clock-sub">IST LIVE</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="kds-controls-group">
          {user.role === 'manager' && (
            <div className="kds-select-station-box">
              <span className="kds-select-label">SWITCH KITCHEN</span>
              <select
                id="kds-outlet-select"
                className="kds-dropdown-pro"
                value={outletId}
                onChange={(e) => setOutletId(Number(e.target.value))}
                aria-label="Select Kitchen Location"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onBack && (
            <button type="button" className="kbtn kbtn-dark" onClick={onBack}>
              {backLabel || '← Back to Admin'}
            </button>
          )}

          <button type="button" className="kbtn kbtn-dark" onClick={load} title="Force sync orders">
            ↻ Refresh
          </button>

          <button
            type="button"
            className="kbtn kbtn-danger"
            onClick={onSignOut ? onSignOut : () => { setToken(null); setUser(null); }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="kds-workspace-body">
        {/* Critical Late Alert Banner */}
        {lateAlerts.length > 0 && (
          <div className="kds-alert-banner">
            <div className="kds-alert-icon">⚠️</div>
            <div>
              <strong>MANAGER ESCALATION: {lateAlerts.length} ORDER{lateAlerts.length > 1 ? 'S' : ''} OVERDUE BY 10+ MINS</strong>
              <div className="small" style={{ opacity: 0.9 }}>
                Expedite immediately — customers notified: {lateAlerts.map((o) => `#${o.order_no}`).join(', ')}
              </div>
            </div>
          </div>
        )}

        {err && (
          <div className="kds-alert-banner" style={{ background: '#7F1D1D' }}>
            <span>{err}</span>
            <button type="button" className="kbtn kbtn-dark" onClick={load} style={{ marginLeft: 16 }}>
              Retry
            </button>
          </div>
        )}

        {/* Orders Card Grid */}
        {orders.length === 0 ? (
          <div className="kds-empty-ticket-card">
            <h2 className="serif" style={{ fontSize: 28, color: '#F5F5F4' }}>Kitchen Queue Clear</h2>
            <p style={{ color: '#A8A29E', marginTop: 4 }}>
              All customer orders for {outlet?.name || 'this outlet'} are dispatched.
              Incoming direct orders ring here in real-time.
            </p>
          </div>
        ) : (
          <div className="kds-cards-grid">
            {orders.map((o) => {
              const elapsed = Math.max(0, Math.floor((now - new Date(o.created_at)) / 60000));
              const minutesLate = lateFor(o);
              const late = minutesLate > 0;
              const criticalLate = minutesLate >= 10;
              const remaining = Math.max(0, Math.round((new Date(o.promised_at) - now) / 60000));
              const isReady = o.status === 'Ready';
              const isNew = o.status === 'Placed';
              const isPreparing = o.status === 'Preparing';

              // Visual styling hierarchy
              const ticketClass = criticalLate
                ? 'ticket-critical-late'
                : late
                  ? 'ticket-late'
                  : isReady
                    ? 'ticket-ready'
                    : isPreparing
                      ? 'ticket-preparing'
                      : 'ticket-new';

              const next = nextStage(o);
              const isOverrideOpen = !!showOverride[o.id];

              return (
                <div key={o.id} className={`kds-order-ticket ${ticketClass}`}>
                  {/* Ticket Header Bar */}
                  <div className="ticket-top-row">
                    <div className="ticket-id-badge">
                      <span className="ticket-num">#{o.order_no}</span>
                      <span className="ticket-channel">DIRECT APP</span>
                    </div>

                    <div className="ticket-elapsed-badge">
                      <span className="timer-dot" />
                      <span>{elapsed}m elapsed</span>
                    </div>
                  </div>

                  {/* Stage Status Tagline */}
                  <div className="ticket-status-row">
                    <div className={`ticket-pill-status ${ticketClass}`}>
                      {criticalLate ? `CRITICAL LATE · +${minutesLate}M OVER` :
                       late ? `RUNNING LATE · +${minutesLate}M` :
                       isReady ? 'READY FOR PICKUP ✓' :
                       isPreparing ? `COOKING ON DUM · ~${remaining}M LEFT` :
                       `NEW ORDER · PROMISED IN ${remaining}M`}
                    </div>

                    <span className="ticket-bill-tag">
                      {o.payment_method} · {fmt(o.payable)}
                    </span>
                  </div>

                  {/* Ordered Items (Readable from 2 metres) */}
                  <div className="ticket-items-list">
                    {o.items.map((it, i) => (
                      <div key={i} className="ticket-item-row">
                        <div className="ticket-item-qty">×{it.qty}</div>
                        <div className="ticket-item-info">
                          <strong className="ticket-item-name">{it.item_name}</strong>
                          {it.portion && (
                            <span className="ticket-item-portion">{it.portion}</span>
                          )}
                          {it.addons && it.addons.length > 0 && (
                            <div className="ticket-item-addons">
                              + {it.addons.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Location Destination */}
                  {o.delivery_address && (
                    <div className="ticket-address-box">
                      <span className="ticket-address-lbl">DELIVER TO:</span>
                      <span className="ticket-address-val">{o.delivery_address}</span>
                    </div>
                  )}

                  {/* Honest AI Prep Time Estimation */}
                  <div className="ticket-timing-box">
                    <div>
                      <span className="timing-lbl">Promised by {fmtTime(o.promised_at)}</span>
                      <span className="timing-calc">
                        AI Est: {o.estimate?.promised || o.estimate_minutes}m (Base {o.estimate?.base}m + Queue {o.estimate?.queueLoad}m)
                      </span>
                    </div>
                    {late && (
                      <span className="timing-late-tag">+{minutesLate}m overdue</span>
                    )}
                  </div>

                  {/* Primary Stage Action Button (Huge Touch Target) */}
                  {next && (
                    <button
                      type="button"
                      className={`kds-stage-action-btn ${ticketClass}`}
                      onClick={() => move(o, next)}
                    >
                      {stageActionText(o.status)}
                    </button>
                  )}

                  {/* Manager Override Section */}
                  {user.role === 'manager' && (
                    <div className="ticket-override-section">
                      <button
                        type="button"
                        className="ticket-override-toggle-btn"
                        onClick={() => setShowOverride({ ...showOverride, [o.id]: !isOverrideOpen })}
                      >
                        <span>⚙ Prep Time Override {isOverrideOpen ? '▴' : '▾'}</span>
                        <span className="small muted">Adjust promised delivery time</span>
                      </button>

                      {isOverrideOpen && (
                        <div className="ticket-override-drawer">
                          <div className="override-quick-chips">
                            {[15, 30, 45, 60].map((m) => (
                              <button
                                key={m}
                                type="button"
                                className="override-chip"
                                onClick={() => doOverride(o, m)}
                              >
                                +{m}m
                              </button>
                            ))}
                          </div>

                          <div className="override-custom-row">
                            <input
                              type="number"
                              min="5"
                              max="240"
                              placeholder="Mins (e.g. 45)"
                              value={override[o.id] || ''}
                              onChange={(e) => setOverride({ ...override, [o.id]: e.target.value })}
                              className="override-num-input"
                            />
                            <button
                              type="button"
                              className="kbtn kbtn-dark"
                              onClick={() => doOverride(o)}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}

                      {overrideNotice[o.id] && (
                        <div className="override-success-msg">
                          ✓ {overrideNotice[o.id]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 86-ing Kitchen Item Stock Control ── */}
        <section className="kds-stock-control-panel">
          <div className="kds-stock-header">
            <div>
              <h2 className="serif" style={{ fontSize: 24, margin: '0 0 2px', color: '#F5F5F4' }}>
                Instant 86-ing Stock Controls ({outlet?.name})
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                Paused items disappear in real-time from the customer menu for {outlet?.name} only. Restored immediately with 1 tap.
              </p>
            </div>
            <span className="small price" style={{ color: '#F59E0B' }}>
              {menu.filter((m) => m.outOfStock).length} Items Paused
            </span>
          </div>

          <div className="kds-stock-pills-wrap">
            {menu.map((m) => {
              const isPaused = !!m.outOfStock;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`kds-stock-pill-btn ${isPaused ? 'paused' : 'live'}`}
                  onClick={() => toggleStock(m, !isPaused)}
                  title={`Tap to ${isPaused ? 'resume' : 'pause'} ${m.name}`}
                >
                  <span className="stock-pill-dot">{isPaused ? '○' : '●'}</span>
                  <span className="stock-pill-name">{m.name}</span>
                  <span className="stock-pill-status">
                    {isPaused ? '86\'D (PAUSED)' : 'LIVE'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
