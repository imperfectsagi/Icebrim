/**
 * Login security thresholds
 * ---------------------------
 * These implement the spec's requirements: rate limiting, temporary
 * account lock, temporary IP lock, CAPTCHA after repeated failures, and
 * audit logs. Thresholds are intentionally layered (account-level AND
 * IP-level) so an attacker can't bypass account lockout by trying many
 * accounts from one IP, or bypass IP lockout by distributing attempts
 * across many IPs against one account.
 */

const ACCOUNT_LOCK_THRESHOLD = 5; // failed attempts before locking the account
const ACCOUNT_LOCK_DURATION_MINUTES = 15;
const IP_LOCK_THRESHOLD = 10; // failed attempts (any account) before locking the IP
const IP_LOCK_DURATION_MINUTES = 30;
const CAPTCHA_REQUIRED_AFTER = 3; // failed attempts before requiring CAPTCHA

export interface LoginAttemptUser {
  id: string;
  failed_login_attempts: number;
  locked_until: string | null;
}

export function isLockedOut(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > Date.now();
}

export async function checkIpLockout(db: D1Database, ip: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT locked_until FROM ip_lockouts WHERE ip_address = ?')
    .bind(ip)
    .first<{ locked_until: string | null }>();
  return isLockedOut(row?.locked_until ?? null);
}

export async function recordFailedAttempt(
  db: D1Database,
  user: LoginAttemptUser,
  ip: string,
): Promise<{ captchaRequired: boolean }> {
  const attempts = user.failed_login_attempts + 1;
  const shouldLockAccount = attempts >= ACCOUNT_LOCK_THRESHOLD;
  const lockedUntil = shouldLockAccount
    ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MINUTES * 60_000).toISOString()
    : null;

  await db
    .prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
    .bind(attempts, lockedUntil, user.id)
    .run();

  // IP-level tracking, independent of which account was targeted.
  const ipRow = await db
    .prepare('SELECT failed_attempts FROM ip_lockouts WHERE ip_address = ?')
    .bind(ip)
    .first<{ failed_attempts: number }>();
  const ipAttempts = (ipRow?.failed_attempts ?? 0) + 1;
  const ipLockedUntil =
    ipAttempts >= IP_LOCK_THRESHOLD
      ? new Date(Date.now() + IP_LOCK_DURATION_MINUTES * 60_000).toISOString()
      : null;

  await db
    .prepare(
      `INSERT INTO ip_lockouts (ip_address, failed_attempts, locked_until, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(ip_address) DO UPDATE SET
         failed_attempts = excluded.failed_attempts,
         locked_until = excluded.locked_until,
         updated_at = datetime('now')`,
    )
    .bind(ip, ipAttempts, ipLockedUntil)
    .run();

  return { captchaRequired: attempts >= CAPTCHA_REQUIRED_AFTER };
}

export async function resetFailedAttempts(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
    .bind(userId)
    .run();
}

export async function logAuditEvent(
  db: D1Database,
  event: { userId: string | null; action: string; ip: string; userAgent: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (id, user_id, action, ip_address, user_agent, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      crypto.randomUUID(),
      event.userId,
      event.action,
      event.ip,
      event.userAgent,
      event.metadata ? JSON.stringify(event.metadata) : null,
    )
    .run();
}

/** Verifies a Cloudflare Turnstile CAPTCHA token server-side. */
export async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await response.json<{ success: boolean }>();
    return data.success === true;
  } catch {
    return false;
  }
}

export function getClientIp(headers: Headers): string {
  return headers.get('CF-Connecting-IP') ?? headers.get('X-Forwarded-For') ?? 'unknown';
}
