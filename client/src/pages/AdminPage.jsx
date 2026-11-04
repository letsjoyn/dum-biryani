// AdminPage.jsx — Executive dashboard + menu CMS + 86-ing stock controls + party enquiries
import { useState, useEffect, useRef } from 'react';
import { api, fmt } from '../api.js';
import { Err, VegMark } from '../components/Common.jsx';

// SVG tab icons
const TabIcon = ({ name }) => {
  if (name === 'dashboard') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
  if (name === 'menu') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
  if (name === 'stock') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
};

function Dashboard({ dash }) {
  if (!dash) return null;
  const stats = [
    { label: 'Orders (7 days)', val: dash.today.orders },
    { label: 'Gross Revenue', val: fmt(dash.today.revenue) },
    { label: 'Median Kitchen Prep', val: dash.today.medianPrep === null ? '—' : `${dash.today.medianPrep} min` },
    { label: 'Cancellations', val: dash.today.cancelled },
    { label: 'Repeat Customers', val: dash.repeatCustomers },
  ];
  return (
    <div className="admin-content-pane">
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat-card">
            <div className="eyebrow">{s.label}</div>
            <div className="stat-val">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Outlet Performance (17 Locations)</h3>
          <span className="small muted">Past 7 days live telemetry</span>
        </div>
        {dash.byOutlet.length === 0 ? (
          <p className="muted">No data yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Outlet Location</th><th>Orders</th><th>Revenue</th>
                  <th>Median prep</th><th>Late now</th><th>Cancelled</th><th>Repeat</th>
                </tr>
              </thead>
              <tbody>
                {dash.byOutlet.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{r.name}</strong>
                      {r.name.includes('Cloud Kitchen') && <span className="small muted" style={{ display: 'block' }}>Cloud Hub</span>}
                    </td>
                    <td>{r.cnt}</td>
                    <td><strong>{fmt(r.rev)}</strong></td>
                    <td>{r.medianPrep === null ? '—' : `${r.medianPrep} min`}</td>
                    <td style={{ color: r.lateCount > 0 ? '#DC2626' : undefined, fontWeight: r.lateCount > 0 ? 700 : 400 }}>
                      {r.lateCount}
                    </td>
                    <td>{r.cancelled}</td>
                    <td>{r.repeatCustomers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Active Kitchen Alerts (Late Orders)</h3>
          <span className="small" style={{ color: dash.lateOrders.length > 0 ? '#DC2626' : '#10B981', fontWeight: 600 }}>
            {dash.lateOrders.length > 0 ? `⚠️ ${dash.lateOrders.length} Late order(s)` : '✓ All kitchens on schedule'}
          </span>
        </div>
        {dash.lateOrders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No late orders across any of the 17 Hyderabad kitchens.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Order</th><th>Outlet</th><th>Status</th><th>Late by</th><th>Payable</th></tr></thead>
              <tbody>
                {dash.lateOrders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>#{o.order_no}</strong></td>
                    <td>{o.outlet_name}</td>
                    <td><span className="status-badge live">{o.status}</span></td>
                    <td style={{ color: '#DC2626', fontWeight: 700 }}>+{o.minutesLate} min</td>
                    <td><strong>{fmt(o.payable)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuCMS({ outlets, items, onSaved }) {
  const formRef = useRef(null);
  const blankForm = () => ({
    name: '', category: 'Biryani', description: '', price: '',
    veg: true, spice: 'Medium', allergens: '', photo: '',
    base_minutes: 25, menu_tag: 'All day',
    outletIds: outlets.map((o) => o.id), outletPrices: {},
    portions: [], addons: [],
  });
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null);
  const [saveErr, setSaveErr] = useState('');
  const [showOverrides, setShowOverrides] = useState(false);
  const [cmsSearch, setCmsSearch] = useState('');

  const save = async (e) => {
    e.preventDefault(); setSaveErr('');
    const cleanList = (list) =>
      (list || []).filter((r) => String(r.label || '').trim() !== '')
        .map((r) => ({ label: String(r.label).trim(), price: Number(r.price) }));
    const body = {
      ...form,
      price: Number(form.price),
      base_minutes: Number(form.base_minutes),
      portions: cleanList(form.portions),
      addons: cleanList(form.addons),
      outletPrices: Object.fromEntries(
        Object.entries(form.outletPrices)
          .filter(([, v]) => v !== '' && v !== null && v !== undefined)
          .map(([k, v]) => [k, Number(v)])
      ),
    };
    try {
      if (editing) await api(`/api/admin/items/${editing}`, { method: 'PUT', body });
      else await api('/api/admin/items', { method: 'POST', body });
      setEditing(null);
      setForm(blankForm());
      onSaved();
    } catch (e2) { setSaveErr(e2.message); }
  };

  const startEdit = (it) => {
    setEditing(it.id);
    setForm({
      name: it.name, category: it.category, description: it.description,
      price: it.price, veg: it.veg, spice: it.spice, allergens: it.allergens,
      photo: it.photo, base_minutes: it.base_minutes, menu_tag: it.menu_tag,
      outletIds: it.outlets.map((o) => o.outlet_id),
      outletPrices: Object.fromEntries(
        it.outlets.filter((o) => o.price_override !== null && o.price_override !== undefined)
          .map((o) => [o.outlet_id, o.price_override])
      ),
      portions: it.portions, addons: it.addons,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleActive = async (it) => {
    try { await api(`/api/admin/items/${it.id}`, { method: 'PUT', body: { active: !it.active } }); onSaved(); }
    catch (e) { setSaveErr(e.message); }
  };

  const filteredItems = items.filter((it) =>
    it.name.toLowerCase().includes(cmsSearch.toLowerCase()) ||
    it.category.toLowerCase().includes(cmsSearch.toLowerCase())
  );

  return (
    <div className="admin-content-pane">
      {/* Add/Edit form */}
      <form ref={formRef} onSubmit={save} className="card admin-form-card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{editing ? 'Edit Menu Dish' : 'Add New Menu Item'}</h3>
          {editing && (
            <button type="button" className="btn btn-sec btn-sm" onClick={() => { setEditing(null); setForm(blankForm()); }}>
              Cancel
            </button>
          )}
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="admin-name">Dish Name</label>
            <input id="admin-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Special Chicken Biryani" required />
          </div>
          <div>
            <label htmlFor="admin-category">Category</label>
            <input id="admin-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Biryani, Desserts" required />
          </div>
          <div>
            <label htmlFor="admin-price">Price (₹, incl. 5% GST)</label>
            <input id="admin-price" type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="299" required />
          </div>
          <div>
            <label htmlFor="admin-base">Base Kitchen Minutes</label>
            <input id="admin-base" type="number" min="1" value={form.base_minutes} onChange={(e) => setForm({ ...form, base_minutes: e.target.value })} placeholder="25" />
          </div>
        </div>

        <div>
          <label htmlFor="admin-desc">Description</label>
          <input id="admin-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Authentic slow-cooked dum recipe..." />
        </div>

        <div className="form-grid-3">
          <div>
            <label>Spice Level</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Mild', 'Medium', 'Hot', 'Very Hot'].map((s) => (
                <button key={s} type="button" className={`selectable-chip ${form.spice === s ? 'active' : ''}`} onClick={() => setForm({ ...form, spice: s })}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label>Menu Timing</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All day', 'Lunch', 'Dinner'].map((s) => (
                <button key={s} type="button" className={`selectable-chip ${form.menu_tag === s ? 'active' : ''}`} onClick={() => setForm({ ...form, menu_tag: s })}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label>Dietary Type</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className={`category-filter-btn ${form.veg ? 'active' : ''}`} onClick={() => setForm({ ...form, veg: true })}>Veg</button>
              <button type="button" className={`category-filter-btn ${!form.veg ? 'active' : ''}`} onClick={() => setForm({ ...form, veg: false })}>Non-veg</button>
            </div>
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="admin-allergens">Allergens</label>
            <input id="admin-allergens" value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} placeholder="e.g. Dairy, Gluten" />
          </div>
          <div>
            <label htmlFor="admin-photo">Photo URL</label>
            <input id="admin-photo" value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://images.unsplash.com/…" />
          </div>
        </div>

        {/* Portions */}
        <div className="admin-field-group">
          <label>Portions (Optional — leave empty for single fixed price)</label>
          {(form.portions || []).map((pp, i) => (
            <div key={i} className="admin-row">
              <input aria-label="Portion label" placeholder="Portion (e.g. Single / Family)" value={pp.label}
                onChange={(e) => setForm({ ...form, portions: form.portions.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input aria-label="Portion price" type="number" min="1" placeholder="Price ₹" value={pp.price}
                onChange={(e) => setForm({ ...form, portions: form.portions.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, portions: form.portions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, portions: [...(form.portions || []), { label: '', price: '' }] })}>
            + Add Portion Tier
          </button>
        </div>

        {/* Add-ons */}
        <div className="admin-field-group">
          <label>Dish Add-ons (Optional)</label>
          {(form.addons || []).map((aa, i) => (
            <div key={i} className="admin-row">
              <input aria-label="Add-on label" placeholder="Add-on (e.g. Extra raita)" value={aa.label}
                onChange={(e) => setForm({ ...form, addons: form.addons.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input aria-label="Add-on price" type="number" min="0" placeholder="Price ₹" value={aa.price}
                onChange={(e) => setForm({ ...form, addons: form.addons.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, addons: form.addons.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, addons: [...(form.addons || []), { label: '', price: '' }] })}>
            + Add Optional Add-on
          </button>
        </div>

        {/* Available Outlets (17 Locations) */}
        <div className="admin-field-group">
          <div className="row" style={{ marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Available Kitchens ({form.outletIds.length} of {outlets.length} active)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, outletIds: outlets.map((o) => o.id) })}>All</button>
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, outletIds: [] })}>None</button>
            </div>
          </div>
          <div className="admin-outlets-chip-grid">
            {outlets.map((o) => {
              const active = form.outletIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`admin-outlet-toggle-chip ${active ? 'on' : ''}`}
                  onClick={() => setForm({
                    ...form,
                    outletIds: active ? form.outletIds.filter((x) => x !== o.id) : [...form.outletIds, o.id],
                  })}
                >
                  {o.name} {active ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Price Overrides Collapsible */}
        <div className="admin-field-group">
          <button type="button" className="btn btn-sec btn-sm" onClick={() => setShowOverrides(!showOverrides)}>
            {showOverrides ? 'Hide Outlet Price Overrides' : `Customize Prices by Outlet (${outlets.length} locations) ↓`}
          </button>
          {showOverrides && (
            <div className="admin-overrides-grid" style={{ marginTop: 10 }}>
              {outlets.map((o) => (
                <div key={o.id} className="admin-override-cell">
                  <span className="small muted" style={{ display: 'block' }}>{o.name}</span>
                  <input
                    type="number"
                    min="1"
                    placeholder={`Base ₹${form.price || 0}`}
                    value={form.outletPrices[o.id] ?? ''}
                    onChange={(e) => setForm({ ...form, outletPrices: { ...form.outletPrices, [o.id]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {saveErr && <div className="banner err">{saveErr}</div>}

        <button className="btn" style={{ minHeight: 44, fontSize: 15 }}>
          {editing ? 'Save Dish Changes' : 'Create Menu Item'}
        </button>
      </form>

      {/* Catalog Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            placeholder="Search items by name or category…"
            value={cmsSearch}
            onChange={(e) => setCmsSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <span className="small muted">Showing {filteredItems.length} of {items.length} items</span>
        </div>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Price</th><th>Timing</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id}>
                  <td>
                    <VegMark veg={it.veg} /> <strong>{it.name}</strong>
                    <div className="small muted">
                      {it.category} · {it.spice} · {it.base_minutes}m
                      {it.portions?.length ? ` · ${it.portions.length} sizes` : ''}
                      {it.addons?.length ? ` · ${it.addons.length} add-ons` : ''}
                    </div>
                  </td>
                  <td><strong>{fmt(it.price)}</strong></td>
                  <td><span className="small chip">{it.menu_tag}</span></td>
                  <td>
                    <span style={{ color: it.active ? '#10B981' : '#6B7280', fontWeight: 600, fontSize: 13 }}>
                      {it.active ? '● Live' : '○ Paused'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sec btn-sm" onClick={() => startEdit(it)}>Edit</button>
                      <button className="btn btn-sec btn-sm" onClick={() => toggleActive(it)}>{it.active ? 'Pause' : 'Resume'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockControl({ outlets, items, onUpdated }) {
  const [selectedOutletId, setSelectedOutletId] = useState(outlets[0]?.id || null);
  const [busyItem, setBusyItem] = useState(null);
  const [stockErr, setStockErr] = useState('');
  const [localOverrides, setLocalOverrides] = useState({});

  useEffect(() => {
    if (outlets.length > 0 && (!selectedOutletId || !outlets.some((o) => o.id === selectedOutletId))) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  const outlet = outlets.find((o) => o.id === selectedOutletId) || outlets[0];

  const toggleStock = async (item, currentOos) => {
    const nextOos = !currentOos;
    const key = `${selectedOutletId}:${item.id}`;
    setBusyItem(item.id);
    setStockErr('');
    // Optimistic UI update
    setLocalOverrides((prev) => ({ ...prev, [key]: nextOos }));

    try {
      await api(`/api/kitchen/items/${item.id}/outlet/${selectedOutletId}/stock`, {
        method: 'PATCH',
        body: { outOfStock: nextOos },
      });
      if (onUpdated) await onUpdated();
    } catch (e) {
      // Revert on error
      setLocalOverrides((prev) => ({ ...prev, [key]: currentOos }));
      setStockErr(e.message || 'Failed to update stock status.');
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <div className="admin-content-pane">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ color: '#F59E0B' }}>86-ING &amp; PAUSE DISHES</div>
            <h2 className="serif" style={{ fontSize: 24, margin: '4px 0 2px' }}>Live Outlet Stock Management</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Instantly 86 dishes when ingredients run low. Changes broadcast live to customer apps &amp; KDS immediately.
            </p>
          </div>
          <div style={{ minWidth: 220 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>SELECT LOCATION</label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(Number(e.target.value))}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {stockErr && (
        <div className="banner err" style={{ marginBottom: 14 }}>
          {stockErr}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Dish</th><th>Category</th><th>Current Status at {outlet?.name}</th><th>Action</th></tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const outletInfo = (it.outlets || []).find((o) => o.outlet_id === selectedOutletId);
                const serverOos = outletInfo ? !!outletInfo.out_of_stock : false;
                const overrideKey = `${selectedOutletId}:${it.id}`;
                const isOutOfStock = localOverrides[overrideKey] !== undefined ? localOverrides[overrideKey] : serverOos;

                return (
                  <tr key={it.id}>
                    <td>
                      <VegMark veg={it.veg} /> <strong>{it.name}</strong>
                    </td>
                    <td><span className="small chip">{it.category}</span></td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: isOutOfStock ? '#DC2626' : '#10B981',
                      }}>
                        {isOutOfStock ? '🔴 OUT OF STOCK (86\'d)' : '🟢 READY TO SERVE'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${isOutOfStock ? 'btn-primary' : 'btn-sec'}`}
                        disabled={busyItem === it.id}
                        onClick={() => toggleStock(it, isOutOfStock)}
                        style={{ minWidth: 140 }}
                      >
                        {busyItem === it.id ? 'Updating…' : isOutOfStock ? 'Mark Available' : '86 Dish (Pause)'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PartyEnquiries({ parties, onUpdate }) {
  const [noteInputs, setNoteInputs] = useState({});
  const [busy, setBusy] = useState({});

  const updateParty = async (id, status, note) => {
    setBusy({ ...busy, [id]: true });
    try {
      await api(`/api/party/${id}`, { method: 'PATCH', body: { status, manager_note: note || undefined } });
      onUpdate();
    } catch {}
    finally { setBusy({ ...busy, [id]: false }); }
  };

  if (parties.length === 0) return (
    <div className="card"><p className="muted">No party enquiries yet.</p></div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr><th>Contact</th><th>Preferred Hub</th><th>Date &amp; Time</th><th>Guests</th><th>Status</th><th>Catering Manager Action</th></tr>
          </thead>
          <tbody>
            {parties.map((pp) => (
              <tr key={pp.id}>
                <td>
                  <strong>{pp.name}</strong>
                  <div className="small muted">📞 +91 {pp.phone}</div>
                  {pp.notes && <div className="small muted" style={{ marginTop: 2 }}>Note: {pp.notes}</div>}
                  {pp.manager_note && <div className="small" style={{ color: '#10B981', marginTop: 2, fontWeight: 600 }}>Catering Note: {pp.manager_note}</div>}
                </td>
                <td><strong>{pp.outlet_name}</strong></td>
                <td>{new Date(pp.event_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td><strong>{pp.guests} people</strong></td>
                <td>
                  <span className={`status-badge ${pp.status === 'Confirmed' ? 'live' : ''}`}>
                    {pp.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                    <input
                      placeholder="Manager confirmation note…"
                      value={noteInputs[pp.id] || ''}
                      onChange={(e) => setNoteInputs({ ...noteInputs, [pp.id]: e.target.value })}
                      style={{ fontSize: 12.5, padding: '6px 8px', minHeight: 'auto' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" disabled={busy[pp.id]} style={{ flex: 1, fontSize: 12 }}
                        onClick={() => updateParty(pp.id, 'Confirmed', noteInputs[pp.id])}>
                        Confirm
                      </button>
                      <button className="btn btn-sec btn-sm btn-danger" disabled={busy[pp.id]} style={{ flex: 1, fontSize: 12 }}
                        onClick={() => updateParty(pp.id, 'Declined', noteInputs[pp.id])}>
                        Decline
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage({ outlets }) {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState(null);
  const [items, setItems] = useState([]);
  const [parties, setParties] = useState([]);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr(''); setLoading(true);
    try {
      setDash(await api('/api/admin/dashboard'));
      setItems(await api('/api/admin/items'));
      setParties(await api('/api/party'));
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'menu', label: `Menu CMS (${items.length})` },
    { key: 'stock', label: '86-ing Stock' },
    { key: 'party', label: `Party Orders (${parties.length})` },
  ];

  return (
    <section className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <div className="eyebrow">CENTRAL OPERATIONS · 17 HYDERABAD LOCATIONS</div>
          <h1 className="serif" style={{ fontSize: 36, margin: '4px 0 2px' }}>Run the house.</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Direct ordering metrics, central menu catalog, 86-ing stock controls, and party catering management.
          </p>
        </div>
      </div>

      <Err msg={err} retry={load} />

      <div className="admin-layout">
        {/* Responsive navigation bar: Sidebar on Laptop / Sticky Tab Bar on Mobile */}
        <nav className="admin-sidebar" aria-label="Admin Navigation">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <TabIcon name={t.key} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Dynamic Content */}
        <div className="admin-main-view">
          {loading && !dash && (
            <div className="card"><div className="skeleton" style={{ height: 24, width: '50%' }} /></div>
          )}

          {tab === 'dashboard' && dash && <Dashboard dash={dash} />}

          {tab === 'menu' && (
            <MenuCMS outlets={outlets} items={items} onSaved={load} />
          )}

          {tab === 'stock' && (
            <StockControl outlets={outlets} items={items} onUpdated={load} />
          )}

          {tab === 'party' && (
            <PartyEnquiries parties={parties} onUpdate={load} />
          )}
        </div>
      </div>
    </section>
  );
}
