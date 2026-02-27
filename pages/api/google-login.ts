import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import { signJwt } from '../../lib/jwt';
import { applyCors } from '../../lib/cors';
import { buildSessionCookie } from '../../lib/sessionCookie';
import { resolveRolesForEmail } from '../../lib/roleResolver';
import { AuthUser } from '../../types';

function badRequest(res: NextApiResponse, message = 'Requisição inválida') {
  return res.status(400).json({ ok: false, error: message });
}

function serverError(res: NextApiResponse, message = 'Erro interno') {
  return res.status(500).json({ ok: false, error: message });
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const oAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!GOOGLE_CLIENT_ID || !JWT_SECRET || !oAuthClient) {
    return serverError(res, 'Autenticação via Google não configurada. Defina GOOGLE_CLIENT_ID e JWT_SECRET.');
  }

  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken.trim()) {
    return badRequest(res, 'Token do Google ausente.');
  }

  try {
    const ticket = await oAuthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return badRequest(res, 'Não foi possível verificar o e-mail do Google.');
    }
    const user: AuthUser = {
      email: payload.email,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined,
      roles: resolveRolesForEmail(payload.email),
    };

    const token = signJwt({ sub: payload.email, user }, JWT_SECRET, 60 * 60 * 8);
    const cookie = buildSessionCookie(token, req);
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error('[api/google-login] Falha ao validar token do Google', error);
    return serverError(res, 'Não foi possível autenticar via Google.');
  }
}
