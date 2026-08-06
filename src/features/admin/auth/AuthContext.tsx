import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '@/lib/api-client';

/**
 * Auth model
 * ----------
 * The Worker issues a short-lived JWT access token AND a longer-lived
 * refresh token, both set as HttpOnly, Secure, SameSite=Strict cookies.
 * The browser never has direct access to either token -- this context
 * only tracks *whether* a session is active (via `me`) and exposes
 * login/logout actions that hit the API, which sets/clears the cookies.
 *
 * This deliberately does NOT store the JWT in localStorage/sessionStorage
 * or in JS-readable state, which would expose it to XSS.
 */

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor';
}

interface AuthContextValue {
  user: AdminUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (username: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<AdminUser>('/api/admin/auth/me');
      setUser(me);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Silently refresh the access token shortly before it expires, using the
  // HttpOnly refresh-token cookie. Access tokens are short-lived (e.g. 15
  // minutes) by design, so this keeps the admin logged in during active use
  // while still expiring quickly if the browser closes without a valid
  // refresh token.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const interval = setInterval(
      () => {
        api.post('/api/admin/auth/refresh').catch(() => {
          setUser(null);
          setStatus('unauthenticated');
        });
      },
      10 * 60 * 1000, // refresh every 10 minutes for a 15 minute access token
    );
    return () => clearInterval(interval);
  }, [status]);

  const login = useCallback(async (username: string, password: string, captchaToken?: string) => {
    try {
      const me = await api.post<AdminUser>('/api/admin/auth/login', {
        username,
        password,
        captchaToken,
      });
      setUser(me);
      setStatus('authenticated');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('Unable to sign in. Please try again.', 500);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/admin/auth/logout').catch(() => {});
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshSession: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
