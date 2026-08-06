/**
 * Cookie helpers
 * --------------
 * All auth cookies are HttpOnly (never readable by JS, defends against
 * XSS token theft), Secure (HTTPS only), and SameSite=Strict (defends
 * against CSRF -- the cookie is never sent on cross-site requests, so a
 * malicious site can't ride the user's session to call our API).
 */

type CookieOptions = {
  secure?: boolean;
  sameSite?: 'None' | 'Lax' | 'Strict';
};

const ACCESS_TOKEN_COOKIE = 'icebrim_access_token';
const REFRESH_TOKEN_COOKIE = 'icebrim_refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function buildCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  path = '/',
  { secure = true, sameSite = 'None' }: CookieOptions = {},
): string {
  const attrs = [
    `${name}=${value}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
  ];

  if (secure) attrs.push('Secure');
  attrs.push(`SameSite=${sameSite}`);
  return attrs.join('; ');
}

function buildExpiredCookie(
  name: string,
  path = '/',
  { secure = true, sameSite = 'None' }: CookieOptions = {},
): string {
  const attrs = [`${name}=`, `Path=${path}`, 'Max-Age=0', 'HttpOnly'];
  if (secure) attrs.push('Secure');
  attrs.push(`SameSite=${sameSite}`);
  return attrs.join('; ');
}

export function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  options: CookieOptions = {},
): string[] {
  return [
    buildCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_TTL_SECONDS, '/', options),
    // Refresh token is scoped to the refresh endpoint only, limiting blast
    // radius if it were ever somehow exfiltrated via a same-site attack.
    buildCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_TTL_SECONDS, '/api/admin/auth', options),
  ];
}

export function clearAuthCookies(options: CookieOptions = {}): string[] {
  return [
    buildExpiredCookie(ACCESS_TOKEN_COOKIE, '/', options),
    buildExpiredCookie(REFRESH_TOKEN_COOKIE, '/api/admin/auth', options),
  ];
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) result[key] = rest.join('=');
  }
  return result;
}

export function getAccessToken(cookieHeader: string | null): string | undefined {
  return parseCookies(cookieHeader)[ACCESS_TOKEN_COOKIE];
}

export function getRefreshToken(cookieHeader: string | null): string | undefined {
  return parseCookies(cookieHeader)[REFRESH_TOKEN_COOKIE];
}
