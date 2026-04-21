import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { auth, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState(null); // { id, username, displayName, role, staffId }

  const refresh = useCallback(async () => {
    try {
      const s = await auth.status();
      setSetupRequired(s.setupRequired);
      setUser(s.user || null);
    } catch (e) {
      console.error('Auth status failed', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setUser(null));
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const r = await auth.login(username, password);
    setUser(r.user);
    return r.user;
  }, []);

  const setup = useCallback(async (username, password, displayName) => {
    const r = await auth.setup(username, password, displayName);
    setUser(r.user);
    setSetupRequired(false);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await auth.logout(); } catch {}
    setUser(null);
  }, []);

  const value = {
    loading,
    setupRequired,
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login, logout, setup, refresh
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
