import type { Context, Next } from 'hono';
import type { Env } from '../lib/env';
import { verifyJwt } from '../lib/jwt';
import { getAccessToken } from '../lib/cookies';

export interface AuthedVariables {
  userId: string;
  userRole: 'admin' | 'editor';
}

/**
 * Requires a valid, non-expired access token JWT in the HttpOnly cookie.
 * On success, attaches userId/userRole to context for downstream handlers.
 * On failure, returns 401 -- the frontend's AuthContext treats 401 as
 * "not logged in" and redirects to /admin/login.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthedVariables }>, next: Next) {
  const token = getAccessToken(c.req.header('Cookie') ?? null);
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const payload = await verifyJwt(token, c.env.JWT_ACCESS_SECRET);
  if (!payload) return c.json({ error: 'Session expired' }, 401);

  c.set('userId', payload.sub);
  c.set('userRole', payload.role);
  await next();
}

/** Restricts a route to the 'admin' role only (editors are blocked). */
export async function requireAdminRole(c: Context<{ Bindings: Env; Variables: AuthedVariables }>, next: Next) {
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  await next();
}
