import fs from 'fs';
import path from 'path';
import { AuthRole } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'user-roles.json');

const ensureDataFile = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const defaults: Record<string, AuthRole> = {
      'brunorichter@gmail.com': 'admin',
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaults, null, 2));
  }
};

const readRolesFromDisk = (): Record<string, AuthRole> => {
  try {
    ensureDataFile();
    const fileContents = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(fileContents) as Record<string, AuthRole>;
    return parsed;
  } catch (error) {
    console.error('[userRolesStore] Falha ao ler os papéis do disco', error);
    return { 'brunorichter@gmail.com': 'admin' };
  }
};

const writeRolesToDisk = (roles: Record<string, AuthRole>) => {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(roles, null, 2), 'utf-8');
  } catch (error) {
    console.error('[userRolesStore] Falha ao salvar os papéis no disco', error);
  }
};

export const getStoredRoles = (): Record<string, AuthRole> => {
  return readRolesFromDisk();
};

export const getStoredRole = (email: string): AuthRole | undefined => {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  const roles = readRolesFromDisk();
  return roles[normalized];
};

export const setStoredRole = (email: string, role: AuthRole): void => {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  const roles = readRolesFromDisk();
  roles[normalized] = role;
  writeRolesToDisk(roles);
};

export const removeStoredRole = (email: string): void => {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  const roles = readRolesFromDisk();
  if (roles[normalized]) {
    delete roles[normalized];
    writeRolesToDisk(roles);
  }
};
