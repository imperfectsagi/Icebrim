import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { userAccountUpdateSchema, passwordChangeSchema } from '../lib/schemas';
import { hashPassword, verifyPassword } from '../lib/password';
import { logAuditEvent, getClientIp } from '../lib/login-security';

export const adminUsers = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminUsers.use('*', requireAuth);

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
}

adminUsers.put('/me', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = userAccountUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);

  const userId = c.get('userId');

  // Uniqueness checks excluding the current user's own row.
  const usernameTaken = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .bind(parsed.data.username, userId)
    .first();
  if (usernameTaken) return c.json({ error: 'Username already taken' }, 409);

  const emailTaken = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .bind(parsed.data.email, userId)
    .first();
  if (emailTaken) return c.json({ error: 'Email already in use' }, 409);

  await c.env.DB.prepare(`UPDATE users SET username = ?, email = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(parsed.data.username, parsed.data.email, userId)
    .run();

  await logAuditEvent(c.env.DB, {
    userId,
    action: 'account_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json({ id: userId, username: parsed.data.username, email: parsed.data.email });
});

adminUsers.put('/me/password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid password' }, 400);

  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const currentValid = await verifyPassword(parsed.data.currentPassword, user.password_hash);
  if (!currentValid) return c.json({ error: 'Current password is incorrect' }, 401);

  const newHash = await hashPassword(parsed.data.newPassword);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(newHash, userId)
    .run();

  // Revoke all existing refresh tokens on password change, forcing
  // re-authentication everywhere else the account might be logged in --
  // standard practice so a stolen session can't outlive a password reset.
  await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(userId)
    .run();

  await logAuditEvent(c.env.DB, {
    userId,
    action: 'password_changed',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json({ success: true });
});
