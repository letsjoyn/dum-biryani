// PartyPage.jsx — bulk & party order form with clean spacing & modern cards
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
    <section className="party-form-wrap" style={{ maxWidth: 640, margin: '32px auto' }}>
      {!user && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          Sign in to submit a party enquiry — you can fill the form first, and your progress is saved.
          <button className="btn btn-sec btn-sm" style={{ marginLeft: 10 }} onClick={goLogin}>Sign in</button>
        </div>
      )}

      <div className="eyebrow">Bulk & Party Orders</div>
      <h1 className="serif" style={{ fontSize: 40, margin: '8px 0 6px' }}>Feed the whole party.</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 15 }}>
        Party orders need at least 48 hours notice. Guaranteed on-time delivery with live catering manager confirmation.
      </p>

      <form onSubmit={submit} className="card grid" style={{ padding: 24 }} noValidate>
        {/* Contact */}
        <div className="form-section">
          <h3>1. Contact Details</h3>
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
              <label htmlFor="party-phone">Phone number</label>
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
                ? <p className="small" style={{ color: '#8A2C10', marginTop: 4 }}>{phoneErr}</p>
                : <p className="hint">We'll call this number to confirm details.</p>
              }
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* Outlet */}
        <div className="form-section">
          <h3>2. Preferred Outlet</h3>
          <div className="party-outlets-grid">
            {outlets.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`party-outlet-card ${Number(form.outletId) === o.id ? 'active' : ''}`}
                onClick={() => set('outletId', o.id)}
                aria-pressed={Number(form.outletId) === o.id}
              >
                <div className="row">
                  <strong style={{ fontSize: 14 }}>{o.name}</strong>
                  {Number(form.outletId) === o.id && <span className="badge-selected">Selected</span>}
                </div>
                <span className="small muted" style={{ display: 'block', marginTop: 3 }}>FSSAI: {o.fssai}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="divider" />

        {/* Guests */}
        <div className="form-section">
          <h3>3. Number of Guests</h3>
          <div className="stepper" style={{ marginBottom: 12 }}>
            <button type="button" aria-label="Fewer guests" onClick={() => set('guests', clampGuests(form.guests - 10))}>−</button>
            <strong style={{ fontSize: 20 }}>{form.guests}</strong>
            <button type="button" aria-label="More guests" onClick={() => set('guests', clampGuests(form.guests + 10))}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[10, 20, 50, 100].map((g) => (
              <button
                key={g}
                type="button"
                className={`selectable-chip ${form.guests === g ? 'active' : ''}`}
                onClick={() => set('guests', g)}
              >
                {g === 100 ? '100+ guests' : `${g} guests`}
              </button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Minimum 10 guests, up to 500 guests.</p>
        </div>

        <hr className="divider" />

        {/* When */}
        <div className="form-section">
          <h3>4. Event Date & Time Slot</h3>
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Select Date (Earliest: 48h notice)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {validDays().map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`selectable-chip ${partyDate === d ? 'active' : ''}`}
                  onClick={() => setPartyDate(d)}
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Select Delivery Time Slot</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIME_SLOTS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={`selectable-chip ${partyTime === v ? 'active' : ''}`}
                  onClick={() => setPartyTime(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Booking for: <strong>{dayLabel(partyDate)} at {TIME_SLOTS.find(([v]) => v === partyTime)?.[1]}</strong>
            </p>
          </div>
        </div>

        <hr className="divider" />

        {/* Notes */}
        <div className="form-section">
          <h3>5. Additional Notes & Venue Details</h3>
          <textarea
            id="party-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="E.g. 15 Veg, 35 Chicken Dum Biryani, exact venue delivery directions…"
          />
        </div>

        <Err msg={err} />
        {ok && <div className="banner ok">{ok}</div>}

        <button className="btn btn-full" disabled={busy} style={{ minHeight: 46, fontSize: 15 }}>
          {busy ? 'Saving…' : user ? 'Submit Party Enquiry' : 'Sign in to Submit Enquiry'}
        </button>
      </form>
    </section>
  );
}
