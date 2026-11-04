// LoginPage.jsx — sign in / register
import { useState } from 'react';
import { api, setToken } from '../api.js';
import { Err } from '../components/Common.jsx';

export default function LoginPage({ onDone, notice }) {
  const [email, setEmail] = useState('customer@demo.in');
  const [password, setPassword] = useState('Demo123!');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() && mode === 'register') { setErr('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('That email address doesn\'t look right.'); return; }
    if (!password) { setErr('Please enter your password.'); return; }
    if (mode === 'register' && password.length < 8) { setErr('Password needs at least 8 characters.'); return; }
    if (mode === 'register' && password !== confirmPassword) { setErr('Passwords don\'t match.'); return; }
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

  const fill = (em) => { setEmail(em); setPassword('Demo123!'); setMode('login'); setErr(''); };

  return (
    <section className="login-page">
      <div className="eyebrow">Dum House · Demo sign-in</div>
      <h1 className="serif" style={{ fontSize: 44, margin: '8px 0 4px' }}>Welcome back.</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Sign in to order, track your food, and earn loyalty points.
      </p>

      {notice && <div className="banner" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* Demo shortcuts */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Demo accounts · password: Demo123!</div>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Tap a role to fill its email, then Sign in.
        </p>
        <div className="login-demos">
          <button className="chip" onClick={() => fill('customer@demo.in')}>
            🧑 Customer
          </button>
          <button className="chip" onClick={() => fill('kitchen@demo.in')}>
            👨‍🍳 Kitchen (Kondapur)
          </button>
          <button className="chip" onClick={() => fill('manager@demo.in')}>
            📊 Manager
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Kitchen staff see only their outlet. Managers get Admin + Kitchen display.
        </p>
      </div>

      {/* Auth form */}
      <form onSubmit={submit} className="card grid" noValidate>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button
            type="button"
            className={`chip ${mode === 'login' ? 'on' : ''}`}
            onClick={() => { setMode('login'); setErr(''); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`chip ${mode === 'register' ? 'on' : ''}`}
            onClick={() => { setMode('register'); setErr(''); }}
          >
            Create account
          </button>
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="login-name">Full name</label>
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="login-password">
            Password{mode === 'register' ? ' · at least 8 characters' : ''}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              style={{ flex: 1, minWidth: 0 }}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="btn btn-sec btn-sm"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              placeholder="Type your password again"
              autoComplete="new-password"
            />
          </div>
        )}

        <Err msg={err} />

        <button className="btn" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create customer account'}
        </button>
      </form>
    </section>
  );
}
