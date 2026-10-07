import type { Context, Next } from 'hono';
import type { Env } from '../lib/env';
import { verifyJwt } from '../lib/jwt';
import { getAccessToken } from '../lib/cookies';
import { normalizeSystemSettings } from '../lib/system-settings';

export interface AuthedVariables {
  userId: string;
  userRole: 'admin' | 'editor';
  /** The admin session this request belongs to (refresh_tokens.id). */
  sessionId: string;
  /** Inactivity timeout currently configured in System Settings. */
  sessionTimeoutMinutes: number;
}

/** Don't write last_activity_at more often than this -- keeps D1 writes low. */
const ACTIVITY_WRITE_INTERVAL_MS = 15_000;

interface SessionRow {
  revoked_at: string | null;
  expires_at: string;
  last_activity_at: string | null;
  created_at: string;
  settings: string | null;
}

/**
 * Requires a valid access-token JWT in the HttpOnly cookie AND a live admin
 * session behind it.
 *
 * The session check is what makes "Admin session timeout" in System
 * Settings real: the token's `sid` claim points at a row in refresh_tokens
 * that records when the admin was last active. If that was longer ago than
 * the configured number of minutes the session is revoked and the request
 * is rejected with 401 -- so an admin who walks away is logged out even if
 * their (up to 15 minute) access token is technically still valid.
 *
 * Any authenticated admin request counts as activity. The admin panel also
 * sends a lightweight heartbeat while the admin is typing/clicking, so
 * editing a long post without saving does not count as being idle.
 *
 * On failure returns 401 -- the frontend's AuthContext treats 401 as
 * "not logged in" and redirects to /admin/login.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthedVariables }>, next: Next) {
  const token = getAccessToken(c.req.header('Cookie') ?? null);
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const payload = await verifyJwt(token, c.env.JWT_ACCESS_SECRET);
  if (!payload) return c.json({ error: 'Session expired' }, 401);

  // Tokens issued before the inactivity-timeout feature have no session id;
  // asking those admins to sign in once more is the safe behaviour.
  const sid = typeof payload.sid === 'string' ? payload.sid : null;
  if (!sid) return c.json({ error: 'Session expired' }, 401);

  const session = await c.env.DB.prepare(
    `SELECT revoked_at, expires_at, last_activity_at, created_at,
            (SELECT value FROM site_content WHERE key = 'system_settings') AS settings
     FROM refresh_tokens WHERE id = ? AND user_id = ?`,
  )
    .bind(sid, payload.sub)
    .first<SessionRow>();

  if (!session || session.revoked_at || Date.parse(session.expires_at) < Date.now()) {
    return c.json({ error: 'Session expired' }, 401);
  }

  let rawSettings: unknown = null;
  try {
    rawSettings = session.settings ? JSON.parse(session.settings) : null;
  } catch {
    rawSettings = null;
  }
  const timeoutMinutes = normalizeSystemSettings(rawSettings).sessionTimeoutMinutes;

  // SQLite's datetime('now') (used for created_at) is UTC without a "Z".
  const createdMs = Date.parse(session.created_at.includes('T') ? session.created_at : `${session.created_at.replace(' ', 'T')}Z`);
  const lastActiveMs = session.last_activity_at ? Date.parse(session.last_activity_at) : createdMs;
  const now = Date.now();
  const idleMs = now - (Number.isFinite(lastActiveMs) ? lastActiveMs : createdMs);

  if (idleMs > timeoutMinutes * 60_000) {
    await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`)
      .bind(sid)
      .run();
    return c.json({ error: 'You were signed out after a period of inactivity.', reason: 'idle' }, 401);
  }

  if (idleMs > ACTIVITY_WRITE_INTERVAL_MS) {
    await c.env.DB.prepare(`UPDATE refresh_tokens SET last_activity_at = ? WHERE id = ?`)
      .bind(new Date(now).toISOString(), sid)
      .run();
  }

  c.set('userId', payload.sub);
  c.set('userRole', payload.role);
  c.set('sessionId', sid);
  c.set('sessionTimeoutMinutes', timeoutMinutes);
  await next();
}

/** Restricts a route to the 'admin' role only (editors are blocked). */
export async function requireAdminRole(c: Context<{ Bindings: Env; Variables: AuthedVariables }>, next: Next) {
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  await next();
}
