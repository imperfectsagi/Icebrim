import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '@/lib/api-client';

/**
 * Auth model
 * ----------
 * The Worker issues a short-lived JWT access token AND a longer-lived
 * refresh token, both set as HttpOnly, Secure cookies (SameSite=None
 * today because the API is cross-site from the frontend -- see
 * workers/src/lib/cookies.ts and DEPLOYMENT.md §4 for why that's the
 * actual cause of mobile logout-after-refresh, and how mapping a
 * same-site API domain switches this to SameSite=Lax with no code
 * changes). The browser never has direct access to either token -- this
 * context only tracks *whether* a session is active (via `me`) and
 * exposes login/logout actions that hit the API, which sets/clears the
 * cookies.
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
  /** True only when a previously-active session was lost (refresh failed
   * or was revoked) -- distinct from simply never having logged in, so the
   * login page can explain *why* the admin landed there instead of showing
   * a bare form as if nothing happened. */
  sessionExpired: boolean;
  login: (username: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<AdminUser>('/api/admin/auth/me');
      setUser(me);
      setStatus('authenticated');
      setSessionExpired(false);
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
          // Distinguish this from a fresh visit: the admin WAS logged in
          // and the session was lost (expired refresh token, revoked
          // elsewhere, etc.), not just "hasn't logged in yet."
          setSessionExpired(true);
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
      setSessionExpired(false);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('Unable to sign in. Please try again.', 500);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/admin/auth/logout').catch(() => {});
    setUser(null);
    setStatus('unauthenticated');
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, sessionExpired, login, logout, refreshSession: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
