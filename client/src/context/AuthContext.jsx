import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { clearCheckoutSession } from '../lib/checkout.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/auth/me')
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { user: u } = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    // Don't leave this person's address or checkout for the next user of the device.
    clearCheckoutSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
