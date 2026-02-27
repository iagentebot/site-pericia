import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../lib/cors';
import { clearSessionCookie } from '../../lib/sessionCookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const cookie = clearSessionCookie(req);
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}

