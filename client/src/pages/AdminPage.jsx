// AdminPage.jsx — dashboard + menu CMS + party enquiries
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
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
};

function Dashboard({ dash }) {
  if (!dash) return null;
  const stats = [
    { label: 'Orders · last 7 days', val: dash.today.orders },
    { label: 'Revenue · last 7 days', val: fmt(dash.today.revenue) },
    { label: 'Median prep', val: dash.today.medianPrep === null ? '—' : `${dash.today.medianPrep} min` },
    { label: 'Cancellations', val: dash.today.cancelled },
    { label: 'Repeat customers', val: dash.repeatCustomers },
  ];
  return (
    <>
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat-card">
            <div className="eyebrow">{s.label}</div>
            <div className="stat-val">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>By outlet — last 7 days</h3>
        {dash.byOutlet.length === 0 ? (
          <p className="muted">No data yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Outlet</th><th>Orders</th><th>Revenue</th>
                  <th>Median prep</th><th>Late now</th><th>Cancelled</th><th>Repeat</th>
                </tr>
              </thead>
              <tbody>
                {dash.byOutlet.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.cnt}</td>
                    <td>{fmt(r.rev)}</td>
                    <td>{r.medianPrep === null ? '—' : `${r.medianPrep} min`}</td>
                    <td style={{ color: r.lateCount > 0 ? '#C2410C' : undefined }}>{r.lateCount}</td>
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
        <h3 style={{ marginTop: 0 }}>Late orders right now</h3>
        {dash.lateOrders.length === 0 ? (
          <p className="muted">No late orders. ✅ Good kitchen.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Order</th><th>Outlet</th><th>Status</th><th>Late by</th><th>Amount</th></tr></thead>
              <tbody>
                {dash.lateOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.order_no}</td>
                    <td>{o.outlet_name}</td>
                    <td>{o.status}</td>
                    <td style={{ color: '#C2410C', fontWeight: 700 }}>{o.minutesLate} min</td>
                    <td>{fmt(o.payable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>All figures are from the live order table — not hardcoded.</p>
    </>
  );
}

function MenuCMS({ outlets, items, err, onSaved }) {
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

  return (
    <>
      {/* Add/Edit form */}
      <form ref={formRef} onSubmit={save} className="card grid" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px' }}>{editing ? 'Edit item' : 'Add a menu item'}</h3>

        <div className="form-grid-2">
          <div>
            <label htmlFor="admin-name">Name</label>
            <input id="admin-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="admin-category">Category</label>
            <input id="admin-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="admin-price">Price (₹, incl. 5% GST)</label>
            <input id="admin-price" type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="admin-base">Base prep minutes</label>
            <input id="admin-base" type="number" min="1" value={form.base_minutes} onChange={(e) => setForm({ ...form, base_minutes: e.target.value })} />
          </div>
        </div>

        <div>
          <label htmlFor="admin-desc">Description</label>
          <input id="admin-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="form-grid-3">
          <div>
            <label>Spice level</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Mild', 'Medium', 'Hot', 'Very Hot'].map((s) => (
                <button key={s} type="button" className={`chip ${form.spice === s ? 'on' : ''}`} onClick={() => setForm({ ...form, spice: s })}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label>Menu timing</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All day', 'Lunch', 'Dinner'].map((s) => (
                <button key={s} type="button" className={`chip ${form.menu_tag === s ? 'on' : ''}`} onClick={() => setForm({ ...form, menu_tag: s })}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label>Type</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className={`chip ${form.veg ? 'on' : ''}`} onClick={() => setForm({ ...form, veg: true })}>🟢 Veg</button>
              <button type="button" className={`chip ${!form.veg ? 'on' : ''}`} onClick={() => setForm({ ...form, veg: false })}>🔴 Non-veg</button>
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
            <input id="admin-photo" value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://…" />
          </div>
        </div>

        {/* Portions */}
        <div>
          <label>Portions — leave empty for single-price item</label>
          <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>Absolute prices per portion (e.g. Single ₹299, Family ₹900).</p>
          {(form.portions || []).map((pp, i) => (
            <div key={i} className="admin-row">
              <input aria-label="Portion label" placeholder="e.g. Single" value={pp.label}
                onChange={(e) => setForm({ ...form, portions: form.portions.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input aria-label="Portion price" type="number" min="1" placeholder="Price ₹" value={pp.price}
                onChange={(e) => setForm({ ...form, portions: form.portions.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, portions: form.portions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, portions: [...(form.portions || []), { label: '', price: '' }] })}>
            + Add portion
          </button>
        </div>

        {/* Add-ons */}
        <div>
          <label>Add-ons</label>
          {(form.addons || []).map((aa, i) => (
            <div key={i} className="admin-row">
              <input aria-label="Add-on label" placeholder="e.g. Extra raita" value={aa.label}
                onChange={(e) => setForm({ ...form, addons: form.addons.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input aria-label="Add-on price" type="number" min="0" placeholder="Price ₹" value={aa.price}
                onChange={(e) => setForm({ ...form, addons: form.addons.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, addons: form.addons.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ ...form, addons: [...(form.addons || []), { label: '', price: '' }] })}>
            + Add add-on
          </button>
        </div>

        {/* Outlet prices */}
        <div>
          <label>Price by outlet (leave blank to use base price)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
            {outlets.map((o) => (
              <div key={o.id}>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{o.name}</label>
                <input type="number" min="1" placeholder={`Base ${fmt(form.price || 0)}`}
                  value={form.outletPrices[o.id] ?? ''}
                  onChange={(e) => setForm({ ...form, outletPrices: { ...form.outletPrices, [o.id]: e.target.value } })} />
              </div>
            ))}
          </div>
        </div>

        {/* Available outlets */}
        <div>
          <label>Available at outlets</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {outlets.map((o) => (
              <button key={o.id} type="button"
                className={`chip ${form.outletIds.includes(o.id) ? 'on' : ''}`}
                aria-pressed={form.outletIds.includes(o.id)}
                onClick={() => setForm({
                  ...form,
                  outletIds: form.outletIds.includes(o.id)
                    ? form.outletIds.filter((x) => x !== o.id)
                    : [...form.outletIds, o.id],
                })}>
                {o.name}{form.outletIds.includes(o.id) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>

        {saveErr && <div className="banner err">{saveErr}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">{editing ? 'Save changes' : 'Add item'}</button>
          {editing && <button type="button" className="btn btn-sec" onClick={() => { setEditing(null); setForm(blankForm()); }}>Cancel</button>}
        </div>
      </form>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="card"><p className="muted">No menu items yet — add one above.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Price</th><th>Tag</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <VegMark veg={it.veg} /> <strong>{it.name}</strong>
                      <div className="small muted">
                        {it.category} · {it.spice}
                        {it.portions?.length ? ` · ${it.portions.length} portion${it.portions.length > 1 ? 's' : ''}` : ''}
                        {it.addons?.length ? ` · ${it.addons.length} add-on${it.addons.length > 1 ? 's' : ''}` : ''}
                      </div>
                    </td>
                    <td>{fmt(it.price)}</td>
                    <td>{it.menu_tag}</td>
                    <td>
                      <span style={{ color: it.active ? '#1A7F37' : '#6B6B6B', fontWeight: 600 }}>
                        {it.active ? '● Live' : '○ Paused'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sec btn-sm" onClick={() => startEdit(it)}>Edit</button>
                        <button className="btn btn-sec btn-sm" onClick={() => toggleActive(it)}>{it.active ? 'Pause' : 'Restore'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
            <tr><th>Contact</th><th>Outlet</th><th>When</th><th>Guests</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {parties.map((pp) => (
              <tr key={pp.id}>
                <td>
                  <strong>{pp.name}</strong>
                  <div className="small muted">{pp.phone}</div>
                  {pp.notes && <div className="small muted" style={{ marginTop: 2 }}>{pp.notes}</div>}
                  {pp.manager_note && <div className="small" style={{ color: '#1A7F37', marginTop: 2 }}>Note: {pp.manager_note}</div>}
                </td>
                <td>{pp.outlet_name}</td>
                <td>{new Date(pp.event_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td>{pp.guests}</td>
                <td><span className="chip" style={{ fontSize: 12, padding: '4px 8px' }}>{pp.status}</span></td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                    <input
                      placeholder="Manager note (optional)"
                      value={noteInputs[pp.id] || ''}
                      onChange={(e) => setNoteInputs({ ...noteInputs, [pp.id]: e.target.value })}
                      style={{ fontSize: 13, padding: '6px 8px', minHeight: 'auto' }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
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
    { key: 'menu', label: 'Menu CMS' },
    { key: 'party', label: `Party (${parties.length})` },
  ];

  return (
    <section style={{ marginTop: 24 }}>
      <div className="eyebrow">Central menu · Admin</div>
      <h1 className="serif" style={{ fontSize: 36, margin: '8px 0 20px' }}>Run the house.</h1>

      <Err msg={err} retry={load} />

      <div className="admin-layout">
        {/* Sidebar tabs */}
        <div className="admin-sidebar">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <TabIcon name={t.key} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {loading && !dash && (
            <div className="card"><div className="skeleton" style={{ height: 24, width: '50%' }} /></div>
          )}

          {tab === 'dashboard' && dash && <Dashboard dash={dash} />}

          {tab === 'menu' && (
            <MenuCMS outlets={outlets} items={items} err={err} onSaved={load} />
          )}

          {tab === 'party' && (
            <PartyEnquiries parties={parties} onUpdate={load} />
          )}
        </div>
      </div>
    </section>
  );
}
