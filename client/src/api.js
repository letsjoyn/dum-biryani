const BASE = import.meta.env.VITE_API_URL || '';
export function token() { return localStorage.getItem('dh_token'); }
export function setToken(t) { t ? localStorage.setItem('dh_token', t) : localStorage.removeItem('dh_token'); }
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token() && typeof window !== 'undefined') {
      // Session expired / not signed in: let the app route back to login
      // with a clear message instead of leaving a broken page behind.
      try { window.dispatchEvent(new CustomEvent('dh:session-expired', { detail: data.error || 'Session expired. Please sign in again.' })); } catch {}
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
export const socketUrl = BASE || window.location.origin;
export const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';
