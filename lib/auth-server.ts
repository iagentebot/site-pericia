import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import { verifyJwt } from './jwt';
import { AuthUser } from '../types';

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

interface SessionPayload {
  user?: AuthUser;
  sub?: string;
  iat?: number;
  exp?: number;
}

export function getSessionPayloadFromCookie(cookieHeader?: string | null): SessionPayload | null {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return null;
  const cookies = parseCookies(cookieHeader || '');
  const token = cookies['session'];
  if (!token) return null;
  const { valid, payload } = verifyJwt(token, JWT_SECRET);
  if (!valid || !payload) return null;
  return payload as SessionPayload;
}

export function getSessionUser(ctx: GetServerSidePropsContext) {
  const payload = getSessionPayloadFromCookie(ctx.req.headers?.cookie || '');
  return payload?.user ?? null;
}

export function isRequestAuthenticated(ctx: GetServerSidePropsContext): boolean {
  const payload = getSessionPayloadFromCookie(ctx.req.headers?.cookie || '');
  return !!payload?.user;
}

export function redirectToLogin<T = any>(ctx: GetServerSidePropsContext): GetServerSidePropsResult<T> {
  const returnTo = encodeURIComponent(ctx.resolvedUrl || '/');
  return {
    redirect: {
      destination: `/login?returnTo=${returnTo}`,
      permanent: false,
    },
  };
}

