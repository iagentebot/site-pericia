import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../lib/cors';
import { getSessionPayloadFromCookie } from '../../lib/auth-server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const payload = getSessionPayloadFromCookie(req.headers.cookie || '');
  if (!payload || !payload.user) {
    return res.status(401).json({ ok: false, error: 'Sessão inválida' });
  }

  return res.status(200).json({ ok: true, user: payload.user });
}
