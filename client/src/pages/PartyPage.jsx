// PartyPage.jsx — 1-Page non-scrollable workspace on desktop + sleek responsive flow on mobile
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
    outletId: saved?.outletId || (outlets[0]?.id || 1),
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
      setOk(`Party enquiry #${p.id} submitted! Our catering manager will contact you at +91 ${digits} to confirm your order.`);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const clampGuests = (g) => Math.max(10, Math.min(500, Number(g) || 10));
  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const selectedOutlet = outlets.find((o) => o.id === Number(form.outletId)) || outlets[0];

  return (
    <div className="party-workspace-wrap">
      <div className="party-split-view">
        {/* ── LEFT PANE: Overview & Summary Preview ── */}
        <aside className="party-sidebar-pane">
          <div className="party-sidebar-header">
            <span className="party-badge">HYDERABAD CATERING</span>
            <h1 className="party-hero-title">Feed the <i>whole party.</i></h1>
            <p className="party-hero-desc">
              Authentic dum-cooked biryanis and slow-cooked haleem delivered hot in sealed handis.
              Direct kitchen routing with catering manager confirmation.
            </p>
          </div>

          <div className="party-preview-card">
            <div className="eyebrow" style={{ color: '#F59E0B', marginBottom: 10 }}>LIVE BOOKING PREVIEW</div>
            
            <div className="party-preview-row">
              <span className="party-preview-label">Guests</span>
              <strong className="party-preview-val">{form.guests} people</strong>
            </div>

            <div className="party-preview-row">
              <span className="party-preview-label">Date &amp; Time</span>
              <strong className="party-preview-val">{dayLabel(partyDate)} · {TIME_SLOTS.find(([v]) => v === partyTime)?.[1]}</strong>
            </div>

            <div className="party-preview-row">
              <span className="party-preview-label">Kitchen Hub</span>
              <strong className="party-preview-val">{selectedOutlet?.name || 'Kondapur'}</strong>
            </div>

            <div className="party-preview-row">
              <span className="party-preview-label">FSSAI Licence</span>
              <span className="party-preview-val">{selectedOutlet?.fssai || '10124012001201'}</span>
            </div>

            <div className="party-preview-row">
              <span className="party-preview-label">Customer</span>
              <span className="party-preview-val">{form.name || user?.name || 'Guest'}</span>
            </div>

            <div className="party-policy-note">
              ✓ Minimum 48 hours notice strictly observed<br />
              ✓ FSSAI certified kitchen &amp; tamper-proof seal<br />
              ✓ DPDP Act 2023 compliant data protection
            </div>
          </div>

          {!user && (
            <div className="party-guest-login-card">
              <span>Ordering for a corporate event or wedding?</span>
              <button type="button" className="btn btn-sec btn-sm" onClick={goLogin}>
                Sign In to Auto-Fill
              </button>
            </div>
          )}
        </aside>

        {/* ── RIGHT PANE: Compact Executive Form ── */}
        <main className="party-form-pane">
          <form onSubmit={submit} className="party-form-card" noValidate>
            <div className="party-form-grid">
              {/* 1. Contact Info */}
              <div className="party-section-card">
                <div className="party-section-title">
                  <span className="party-step-num">1</span>
                  <strong>Contact Information</strong>
                </div>
                <div className="form-grid-2">
                  <div>
                    <label htmlFor="party-name">Full name</label>
                    <input
                      id="party-name"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="party-phone">Mobile number</label>
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
                    {phoneErr && <p className="small" style={{ color: '#DC2626', marginTop: 4 }}>{phoneErr}</p>}
                  </div>
                </div>
              </div>

              {/* 2. Kitchen & Guests */}
              <div className="party-section-card">
                <div className="party-section-title">
                  <span className="party-step-num">2</span>
                  <strong>Catering Kitchen &amp; Guest Count</strong>
                </div>
                <div className="form-grid-2">
                  <div>
                    <label htmlFor="party-outlet">Select from 17 Kitchens</label>
                    <select
                      id="party-outlet"
                      value={form.outletId}
                      onChange={(e) => set('outletId', Number(e.target.value))}
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.name.includes('Cloud Kitchen') ? '(Cloud Hub)' : '(Outlet)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Number of guests: <strong>{form.guests}</strong></label>
                    <div className="party-guests-ctrl-row">
                      <div className="party-stepper-box">
                        <button type="button" onClick={() => set('guests', clampGuests(form.guests - 10))}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => set('guests', clampGuests(form.guests + 10))}>+</button>
                      </div>
                      <div className="party-quick-chips">
                        {[20, 50, 100, 200].map((g) => (
                          <button
                            key={g}
                            type="button"
                            className={`party-chip-btn ${form.guests === g ? 'active' : ''}`}
                            onClick={() => set('guests', g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Date & Time */}
              <div className="party-section-card">
                <div className="party-section-title">
                  <span className="party-step-num">3</span>
                  <strong>Event Schedule (Earliest 48h Notice)</strong>
                </div>
                
                <div style={{ marginBottom: 10 }}>
                  <label>Select Date</label>
                  <div className="party-scroll-chips">
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
                  <label>Delivery Slot</label>
                  <div className="party-scroll-chips">
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
                </div>
              </div>

              {/* 4. Notes & Delivery Directions */}
              <div className="party-section-card">
                <div className="party-section-title">
                  <span className="party-step-num">4</span>
                  <strong>Venue Directions &amp; Menu Preferences</strong>
                </div>
                <textarea
                  id="party-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="e.g. 15 Veg Biryani, 35 Chicken Dum Biryani, exact banquet hall or office delivery notes…"
                />
              </div>
            </div>

            <Err msg={err} />
            {ok && <div className="banner ok" style={{ margin: '12px 0' }}>{ok}</div>}

            <button
              className="btn btn-full party-submit-cta"
              disabled={busy}
            >
              {busy ? 'Submitting…' : user ? 'Submit Party Enquiry →' : 'Sign in to Submit Enquiry →'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
