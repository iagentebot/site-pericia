import { AuthRole } from '../types';

export const AVAILABLE_ROLES: AuthRole[] = ['admin', 'contributor', 'readonly'];

export const ROLE_DESCRIPTIONS: Record<AuthRole, string> = {
  admin: 'Controle total (admin)',
  contributor: 'Pode criar e atualizar processos',
  readonly: 'Somente leitura',
};
