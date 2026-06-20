import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserProfile } from '@game-lobby/shared';
import {
  TOKEN_KEY,
  USER_KEY,
  clearStoredAuth,
  isTokenExpired,
  setUnauthorizedHandler,
} from '../lib/auth-token';
import { disconnectSocket } from '../lib/socket';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  login: (token: string, user: UserProfile) => void;
  updateUser: (token: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): { token: string | null; user: UserProfile | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw || isTokenExpired(token)) {
    clearStoredAuth();
    return { token: null, user: null };
  }
  try {
    return { token, user: JSON.parse(raw) as UserProfile };
  } catch {
    clearStoredAuth();
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<UserProfile | null>(stored.user);

  const logout = () => {
    disconnectSocket();
    setToken(null);
    setUser(null);
    clearStoredAuth();
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login: (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      },
      updateUser: (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      },
      logout,
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
