// PartyPage.jsx — bulk & party order form
import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Err } from '../components/Common.jsx';

export default function PartyPage({ user, outlets, goLogin }) {
  const firstValid = () => {
    const d = new Date(Date.now() + 48 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };
  const validDays = () => {
    const out = [];
    const base = new Date(firstValid() + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  };
  const TIME_SLOTS = [
    ['12:00', '12:00 PM'], ['13:00', '1:00 PM'],
    ['18:00', '6:00 PM'], ['19:00', '7:00 PM'],
    ['20:00', '8:00 PM'], ['21:00', '9:00 PM'],
  ];

  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem('dh_party') || 'null'); } catch { return null; }
  };
  const saved = getSaved();

  const [form, setForm] = useState({
    name: saved?.name || user?.name || '',
    phone: saved?.phone || '',
    outletId: saved?.outletId || 1,
    guests: saved?.guests || 30,
    notes: saved?.notes || '',
  });
  const [partyDate, setPartyDate] = useState(() => {
    const d = saved?.eventAt?.slice(0, 10);
    return d && d >= firstValid() ? d : firstValid();
  });
  const [partyTime, setPartyTime] = useState(saved?.eventAt?.slice(11, 16) || '19:00');
  const [err, setErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('dh_party', JSON.stringify({ ...form, eventAt: `${partyDate}T${partyTime}` }));
    } catch {}
  }, [form, partyDate, partyTime]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setPhoneErr(''); setOk('');
    if (!user) { goLogin(); return; }
    const digits = form.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (digits.length !== 10) { setPhoneErr('Please enter a 10-digit mobile number.'); return; }
    setBusy(true);
    try {
      const p = await api('/api/party', {
        method: 'POST',
        body: {
          ...form,
          phone: digits,
          outletId: Number(form.outletId),
          guests: Number(form.guests),
          eventAt: `${partyDate}T${partyTime}`,
        },
      });
      try { localStorage.removeItem('dh_party'); } catch {}
      setOk(`Party enquiry #${p.id} submitted — the catering manager will confirm.`);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const clampGuests = (g) => Math.max(10, Math.min(500, Number(g) || 10));
  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <section style={{ maxWidth: 640, margin: '24px auto' }}>
      {!user && (
        <div className="banner" style={{ marginBottom: 16 }}>
          Sign in to submit a party enquiry — you can fill the form first.
          <button className="btn btn-sec btn-sm" style={{ marginLeft: 10 }} onClick={goLogin}>Sign in</button>
        </div>
      )}

      <div className="eyebrow">Bulk & party orders</div>
      <h1 className="serif" style={{ fontSize: 40, margin: '8px 0 4px' }}>Feed the whole party.</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Party orders need at least 48 hours notice — the earliest day shown is the first you can book.
      </p>

      <form onSubmit={submit} className="card grid" noValidate>
        {/* Contact */}
        <div className="form-section">
          <h3>Contact</h3>
          <div className="form-grid-2">
            <div>
              <label htmlFor="party-name">Your name</label>
              <input
                id="party-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
              />
            </div>
            <div>
              <label htmlFor="party-phone">Phone</label>
              <div className="phone-input">
                <span>+91</span>
                <input
                  id="party-phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => { set('phone', e.target.value.replace(/[^\d ]/g, '')); setPhoneErr(''); }}
                  placeholder="98765 43210"
                  required
                />
              </div>
              {phoneErr
                ? <p className="small" style={{ color: '#7A2E12', marginTop: 4 }}>{phoneErr}</p>
                : <p className="hint">We'll call this number to confirm.</p>
              }
            </div>
          </div>
        </div>

        {/* Outlet */}
        <div className="form-section">
          <h3>Outlet</h3>
          <div className="outlet-cards">
            {outlets.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`outlet-card ${Number(form.outletId) === o.id ? 'on' : ''}`}
                onClick={() => set('outletId', o.id)}
                aria-pressed={Number(form.outletId) === o.id}
              >
                <span className="outlet-card-top">
                  <strong>{o.name}</strong>
                  {Number(form.outletId) === o.id && <span className="outlet-check">✓</span>}
                </span>
                <span className="small muted">FSSAI {o.fssai}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guests */}
        <div className="form-section">
          <h3>Number of guests</h3>
          <div className="stepper" style={{ marginBottom: 10 }}>
            <button type="button" aria-label="Fewer guests" onClick={() => set('guests', clampGuests(form.guests - 10))}>−</button>
            <strong>{form.guests}</strong>
            <button type="button" aria-label="More guests" onClick={() => set('guests', clampGuests(form.guests + 10))}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[10, 20, 50, 100].map((g) => (
              <button key={g} type="button" className={`chip ${form.guests === g ? 'on' : ''}`} onClick={() => set('guests', g)}>
                {g === 100 ? '100+' : g}
              </button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>Party orders: 10 to 500 guests.</p>
        </div>

        {/* When */}
        <div className="form-section">
          <h3>When</h3>
          <div style={{ marginBottom: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Date — earliest valid day first</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {validDays().map((d) => (
                <button key={d} type="button" className={`chip ${partyDate === d ? 'on' : ''}`} onClick={() => setPartyDate(d)}>
                  {dayLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Time slot</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIME_SLOTS.map(([v, l]) => (
                <button key={v} type="button" className={`chip ${partyTime === v ? 'on' : ''}`} onClick={() => setPartyTime(v)}>
                  {l}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              Selected: <strong>{dayLabel(partyDate)} · {TIME_SLOTS.find(([v]) => v === partyTime)?.[1]}</strong>
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <h3>Notes</h3>
          <label htmlFor="party-notes">Anything the kitchen should know</label>
          <textarea
            id="party-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Menu preferences, veg count, venue details…"
          />
        </div>

        <Err msg={err} />
        {ok && <div className="banner ok">{ok}</div>}

        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : user ? 'Submit party enquiry' : 'Sign in to submit'}
        </button>
      </form>
    </section>
  );
}
