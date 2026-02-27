import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../../lib/cors';
import { getSessionPayloadFromCookie } from '../../../lib/auth-server';
import { getStoredRoles, setStoredRole, removeStoredRole } from '../../../lib/userRolesStore';
import { AuthRole } from '../../../types';

const VALID_ROLES: AuthRole[] = ['admin', 'contributor', 'readonly'];

function ensureAdmin(req: NextApiRequest): boolean {
  const payload = getSessionPayloadFromCookie(req.headers.cookie || '');
  if (!payload?.user) return false;
  return Array.isArray(payload.user.roles) && payload.user.roles.includes('admin');
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (!ensureAdmin(req)) {
    return res.status(401).json({ ok: false, error: 'Somente admins podem usar este endpoint.' });
  }

  if (req.method === 'GET') {
    const roles = getStoredRoles();
    const entries = Object.entries(roles).map(([email, role]) => ({ email, role }));
    return res.status(200).json({ ok: true, data: entries });
  }

  if (req.method === 'POST') {
    const { email, role } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ ok: false, error: 'E-mail inválido' });
    }
    const normalizedRole = String(role || '').trim() as AuthRole;
    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ ok: false, error: 'Perfil inválido' });
    }
    setStoredRole(email, normalizedRole);
    return res.status(200).json({ ok: true, data: { email: email.trim().toLowerCase(), role: normalizedRole } });
  }

  if (req.method === 'DELETE') {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ ok: false, error: 'E-mail inválido' });
    }
    removeStoredRole(email);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end('Method Not Allowed');
}
