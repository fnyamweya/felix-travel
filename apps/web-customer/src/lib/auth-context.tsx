import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient, setTokens, clearTokens, isAuthenticated } from './api-client.js';
import type { AuthUser } from '@felix-travel/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(isAuthenticated());

  useEffect(() => {
    if (!isAuthenticated()) { setLoading(false); return; }
    apiClient.auth.me()
      .then((u) => setUser(u))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiClient.auth.login({ email, password });
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try { await apiClient.auth.logout(); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
