// LoginPage.jsx — clean, minimalist sign in / account creation
import { useState } from 'react';
import { api, setToken } from '../api.js';
import { Err } from '../components/Common.jsx';

const DEMO_ROLES = [
  {
    role: 'customer',
    label: 'Customer Account',
    badge: 'Customer Demo',
    email: 'customer@demo.in',
    desc: 'Orders, live kitchen tracking & 5% loyalty rewards',
  },
  {
    role: 'kitchen',
    label: 'Kitchen Staff',
    badge: 'Kitchen KDS',
    email: 'kitchen@demo.in',
    desc: 'Live Kitchen Display System (Placed → Handed over)',
  },
  {
    role: 'manager',
    label: 'Store Manager',
    badge: 'Store Admin',
    email: 'manager@demo.in',
    desc: 'Full access: 86-ing dishes, analytics & coupons',
  },
];

export default function LoginPage({ onDone, notice }) {
  const [email, setEmail] = useState('customer@demo.in');
  const [password, setPassword] = useState('Demo123!');
  const [activeRole, setActiveRole] = useState('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const selectDemoRole = (r) => {
    setActiveRole(r.role);
    setEmail(r.email);
    setPassword('Demo123!');
    setMode('login');
    setErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() && mode === 'register') { setErr('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email address.'); return; }
    if (!password) { setErr('Please enter your password.'); return; }
    if (mode === 'register' && password.length < 8) { setErr('Password must be at least 8 characters long.'); return; }
    if (mode === 'register' && password !== confirmPassword) { setErr('Passwords do not match.'); return; }
    setErr(''); setBusy(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(path, {
        method: 'POST',
        body: mode === 'login'
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), password },
        auth: false,
      });
      setToken(data.token);
      onDone(data.user);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <section className="login-page-container" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h1 className="serif" style={{ fontSize: 36, margin: '0 0 6px' }}>
        {mode === 'login' ? 'Sign in to Dum House' : 'Create an account'}
      </h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
        {mode === 'login'
          ? 'Access your direct orders, live kitchen tracking, and 5% loyalty cashback rewards.'
          : 'Create your Dum House account to earn 5% loyalty rewards on every direct order.'}
      </p>

      {notice && <div className="banner info" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* Main card */}
      <div className="card" style={{ padding: 24 }}>
        {/* Top: Prominent Demo Accounts Selector */}
        <div className="demo-accounts-top-bar">
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 4 }}>
            Demo Accounts (Pre-filled &amp; Ready)
          </div>
          <div className="demo-role-grid">
            {DEMO_ROLES.map((r) => {
              const isSelected = activeRole === r.role && email === r.email && mode === 'login';
              return (
                <button
                  key={r.role}
                  type="button"
                  className={`demo-role-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => selectDemoRole(r)}
                  aria-pressed={isSelected}
                >
                  <span className="demo-role-btn-title">{r.label}</span>
                  <span className="demo-role-btn-email">{r.email}</span>
                  <span className="demo-role-btn-badge">{r.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sleek Tab Mode Switcher */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setErr(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setErr(''); setActiveRole(null); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="grid" style={{ gap: 14 }} noValidate>
          {mode === 'register' && (
            <div>
              <label htmlFor="login-name">Full name</label>
              <input
                id="login-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setActiveRole(DEMO_ROLES.find((d) => d.email === e.target.value)?.role || null);
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password">
              Password {mode === 'register' && <span className="muted font-normal">(min 8 characters)</span>}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{ flex: 1, minWidth: 0 }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                className="btn btn-sec btn-sm"
                style={{ minWidth: 64 }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="login-confirm">Confirm password</label>
              <input
                id="login-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <Err msg={err} />

          <button className="btn btn-full" disabled={busy} style={{ minHeight: 46, fontSize: 15, marginTop: 4 }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </section>
  );
}
