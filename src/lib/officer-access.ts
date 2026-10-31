import type { AppRole } from './auth';
export const OFFICER_PATHS = ['/dashboard', '/command', '/ict', '/supplies', '/manual', '/mail', '/my-activities'] as const;
export function isPersonalAccount(roles: readonly AppRole[]) { return !roles.some(role => role !== 'officer'); }
export function canOpenOfficerPath(roles: readonly AppRole[], path: string) {
  return !isPersonalAccount(roles) || OFFICER_PATHS.some(allowed => allowed === path.replace(/\/$/, ''));
}
