import { AuthRole } from '../types';
import { getStoredRole } from './userRolesStore';

const ROLE_ENV_VARS: { role: AuthRole; env: string }[] = [
  { role: 'admin', env: 'ROLE_ADMIN_ENTRIES' },
  { role: 'contributor', env: 'ROLE_CONTRIBUTOR_ENTRIES' },
  { role: 'readonly', env: 'ROLE_READONLY_ENTRIES' },
];

const normalizeEntry = (value: string) => value.trim().toLowerCase();

const parseEntries = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(/[;,\n]/)
    .map(normalizeEntry)
    .filter(Boolean);
};

const matchesPattern = (pattern: string, email: string) => {
  if (!pattern) return false;
  if (pattern.startsWith('@')) {
    return email.endsWith(pattern);
  }
  return pattern === email;
};

export const resolveRolesForEmail = (email: string): AuthRole[] => {
  const normalizedEmail = email.trim().toLowerCase();
  const storedRole = getStoredRole(normalizedEmail);
  if (storedRole) {
    return [storedRole];
  }

  const roles: AuthRole[] = [];

  ROLE_ENV_VARS.forEach(({ role, env }) => {
    const entries = parseEntries(process.env[env]);
    if (entries.some((entry) => matchesPattern(entry, normalizedEmail))) {
      roles.push(role);
    }
  });

  if (!roles.length) {
    roles.push('readonly');
  }

  return Array.from(new Set(roles));
};

export const ROLE_DESCRIPTIONS: Record<AuthRole, string> = {
  admin: 'Controle total (admin)',
  contributor: 'Pode criar e atualizar processos',
  readonly: 'Somente leitura',
};
