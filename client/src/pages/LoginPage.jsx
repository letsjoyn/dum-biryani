// LoginPage.jsx — clean, minimalist sign in / account creation
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

  const fill = (em) => { setEmail(em); setPassword('Demo123!'); setMode('login'); setErr(''); };

  return (
    <section className="login-page-container" style={{ maxWidth: 440, margin: '48px auto' }}>
      <h1 className="serif" style={{ fontSize: 38, margin: '0 0 6px' }}>
        {mode === 'login' ? 'Welcome back' : 'Create an account'}
      </h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
        {mode === 'login'
          ? 'Sign in to access your direct orders, live tracking, and loyalty rewards.'
          : 'Create your Dum House account to earn 5% loyalty rewards on every direct order.'}
      </p>

      {notice && <div className="banner info" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* Main card */}
      <div className="card" style={{ padding: 24 }}>
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
            onClick={() => { setMode('register'); setErr(''); }}
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
              onChange={(e) => setEmail(e.target.value)}
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

      {/* Quick Role Fillers */}
      <div className="card" style={{ marginTop: 14, padding: '14px 18px', background: '#FAF9F6' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Quick Sign-in (Demo Accounts)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => fill('customer@demo.in')}>
            Customer
          </button>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => fill('kitchen@demo.in')}>
            Kitchen Staff
          </button>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => fill('manager@demo.in')}>
            Manager
          </button>
        </div>
      </div>
    </section>
  );
}
