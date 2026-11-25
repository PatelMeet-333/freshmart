const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const SLOW_MS = 4000;

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Render's free plan sleeps when idle; tell the UI when a request is slow.
let slowCount = 0;
const listeners = new Set();
function setSlow(delta) {
  slowCount = Math.max(0, slowCount + delta);
  listeners.forEach((fn) => fn(slowCount > 0));
}
export function onSlowChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function api(path, { method = 'GET', body } = {}) {
  let markedSlow = false;
  const timer = setTimeout(() => {
    markedSlow = true;
    setSlow(1);
  }, SLOW_MS);
  try {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        credentials: 'include',
        headers: method === 'GET' ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      });
    } catch {
      throw new ApiError('Can’t reach FreshMart. Check your internet connection and try again.', 0, 'NETWORK');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.message || 'Something went wrong. Try again.', res.status, data.code, data.details);
    return data;
  } finally {
    clearTimeout(timer);
    if (markedSlow) setSlow(-1);
  }
}
