import type { IncomingMessage } from 'http';

const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

const serialize = (
  name: string,
  value: string,
  options: { httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: 'Lax' | 'Strict' | 'None'; maxAge?: number } = {}
): string => {
  const parts = [`${name}=${value}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
};

const getForwardedProto = (req?: IncomingMessage) => {
  const header = req?.headers['x-forwarded-proto'];
  return Array.isArray(header) ? header[0] : header;
};

const resolveCookieSecurity = (req?: IncomingMessage): boolean => {
  const cookieSecureEnv = process.env.COOKIE_SECURE?.toLowerCase();
  if (cookieSecureEnv === 'true') return true;
  if (cookieSecureEnv === 'false') return false;
  const forwarded = getForwardedProto(req);
  if (forwarded) return forwarded === 'https';
  return process.env.NODE_ENV === 'production';
};

export const buildSessionCookie = (token: string, req?: IncomingMessage): string => {
  const secure = resolveCookieSecurity(req);
  const forwarded = getForwardedProto(req);
  if (secure && forwarded && forwarded !== 'https') {
    console.warn('[sessionCookie] Secure cookie set but the request is not over HTTPS.');
  }
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
};

export const clearSessionCookie = (req?: IncomingMessage): string => {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: resolveCookieSecurity(req),
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  });
};
