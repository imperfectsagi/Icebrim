import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env';
import { verifyPassword } from '../lib/password';
import { signJwt, verifyJwt } from '../lib/jwt';
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../lib/cookies';
import {
  isLockedOut,
  checkIpLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  logAuditEvent,
  verifyTurnstile,
  getClientIp,
} from '../lib/login-security';
import { requireAuth, type AuthedVariables } from '../middleware/auth';
import { getSystemSettings } from '../lib/system-settings';

const auth = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'editor';
  failed_login_attempts: number;
  locked_until: string | null;
}

async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const { username, password, captchaToken } = parsed.data;
  const ip = getClientIp(c.req.raw.headers);
  const userAgent = c.req.header('User-Agent') ?? null;
  const secureCookie = new URL(c.req.url).protocol === 'https:';

  // IP-level lockout check happens before touching any specific account,
  // so credential-stuffing across many usernames from one IP is blocked too.
  if (await checkIpLockout(c.env.DB, ip)) {
    return c.json({ error: 'Too many attempts from this network. Please try again later.' }, 429);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();

  // Constant-shape response whether or not the user exists, to avoid
  // leaking which usernames are valid via response timing/content.
  if (!user) {
    await logAuditEvent(c.env.DB, { userId: null, action: 'login_failed_unknown_user', ip, userAgent, metadata: { username } });
    return c.json({ error: 'Incorrect username or password.' }, 401);
  }

  if (isLockedOut(user.locked_until)) {
    return c.json({ error: 'This account is temporarily locked. Please try again later.' }, 429);
  }

  // Require CAPTCHA once the account has had repeated recent failures.
  if (user.failed_login_attempts >= 3) {
    if (!captchaToken) return c.json({ error: 'CAPTCHA required' }, 412);
    const captchaValid = await verifyTurnstile(captchaToken, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!captchaValid) return c.json({ error: 'CAPTCHA verification failed' }, 412);
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const { captchaRequired } = await recordFailedAttempt(c.env.DB, user, ip);
    await logAuditEvent(c.env.DB, { userId: user.id, action: 'login_failed', ip, userAgent });
    return c.json({ error: 'Incorrect username or password.' }, captchaRequired ? 412 : 401);
  }

  // Success: reset counters, issue tokens.
  await resetFailedAttempts(c.env.DB, user.id);
  await logAuditEvent(c.env.DB, { userId: user.id, action: 'login_success', ip, userAgent });

  // The refresh_tokens row id doubles as the admin SESSION id: it is carried
  // in the access token (`sid`) so middleware/auth.ts can look the session up
  // and enforce the System Settings inactivity timeout.
  const sessionId = crypto.randomUUID();
  const accessToken = await signJwt({ sub: user.id, role: user.role, sid: sessionId }, c.env.JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL_SECONDS);
  const refreshToken = crypto.randomUUID() + crypto.randomUUID(); // opaque random token, not a JWT
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      sessionId,
      user.id,
      refreshTokenHash,
      new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
      userAgent,
      ip,
      new Date().toISOString(),
    )
    .run();

  for (const cookie of setAuthCookies(accessToken, refreshToken, { secure: secureCookie, sameSite: 'None' })) {
    c.header('Set-Cookie', cookie, { append: true });
  }

  const settings = await getSystemSettings(c.env.DB);
  return c.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
  });
});

auth.post('/refresh', async (c) => {
  const refreshToken = getRefreshToken(c.req.header('Cookie') ?? null);
  if (!refreshToken) return c.json({ error: 'Not authenticated' }, 401);

  const tokenHash = await hashRefreshToken(refreshToken);
  const row = await c.env.DB.prepare(
    `SELECT rt.id as token_id, rt.expires_at, rt.revoked_at, rt.last_activity_at, rt.created_at,
            u.id, u.username, u.email, u.role
     FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      token_id: string;
      expires_at: string;
      revoked_at: string | null;
      last_activity_at: string | null;
      created_at: string;
      id: string;
      username: string;
      email: string;
      role: 'admin' | 'editor';
    }>();

  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ error: 'Session expired' }, 401);
  }

  // The silent background refresh must NOT count as activity (it fires on a
  // timer whether or not anyone is at the keyboard), but it must respect the
  // inactivity timeout -- otherwise an idle tab would renew itself forever.
  const settings = await getSystemSettings(c.env.DB);
  const createdMs = Date.parse(row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`);
  const lastActiveMs = row.last_activity_at ? Date.parse(row.last_activity_at) : createdMs;
  if (Date.now() - lastActiveMs > settings.sessionTimeoutMinutes * 60_000) {
    await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`)
      .bind(row.token_id)
      .run();
    return c.json({ error: 'You were signed out after a period of inactivity.', reason: 'idle' }, 401);
  }

  const secureCookie = new URL(c.req.url).protocol === 'https:';
  const accessToken = await signJwt({ sub: row.id, role: row.role, sid: row.token_id }, c.env.JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL_SECONDS);
  c.header('Set-Cookie', setAuthCookies(accessToken, refreshToken, { secure: secureCookie, sameSite: 'None' })[0], { append: true });

  return c.json({
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
  });
});

auth.post('/logout', async (c) => {
  const refreshToken = getRefreshToken(c.req.header('Cookie') ?? null);
  const secureCookie = new URL(c.req.url).protocol === 'https:';
  if (refreshToken) {
    const tokenHash = await hashRefreshToken(refreshToken);
    await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`)
      .bind(tokenHash)
      .run();
  }
  for (const cookie of clearAuthCookies({ secure: secureCookie, sameSite: 'None' })) {
    c.header('Set-Cookie', cookie, { append: true });
  }
  return c.body(null, 204);
});

auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT id, username, email, role FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; username: string; email: string; role: string }>();
  if (!user) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...user, sessionTimeoutMinutes: c.get('sessionTimeoutMinutes') });
});

// Heartbeat sent by the admin panel while the admin is actually using it
// (typing, clicking, scrolling). requireAuth already records the activity;
// this endpoint exists so the browser can keep the session alive during long
// stretches with no API calls -- e.g. writing a long blog post.
auth.post('/activity', requireAuth, (c) => c.json({ ok: true, sessionTimeoutMinutes: c.get('sessionTimeoutMinutes') }));

// Exposed for debugging/ops use only; not called by the frontend directly.
auth.get('/verify-token', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ valid: false });
  const payload = await verifyJwt(token, c.env.JWT_ACCESS_SECRET);
  return c.json({ valid: !!payload });
});

export default auth;
