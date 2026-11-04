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

export function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d === 'string') {
    // If SQLite default format "YYYY-MM-DD HH:MM:SS" (in UTC), append Z so browser parses as UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(d)) {
      return new Date(d.replace(' ', 'T') + 'Z');
    }
    // If "T" format without timezone offset, append Z
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(d)) {
      return new Date(d + 'Z');
    }
  }
  return new Date(d);
}

export const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = parseDate(iso);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = parseDate(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = parseDate(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};
