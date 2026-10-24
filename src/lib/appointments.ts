import { ROLE_LABELS, type AppRole } from '@/lib/auth';
import type { Json } from '@/integrations/supabase/types';

/** Roles HR may recommend through an appointment. System Administrator is never grantable this way. */
export function grantableAppointmentRoles(): AppRole[] {
  return (Object.keys(ROLE_LABELS) as AppRole[]).filter(r => r !== 'system_admin');
}

export function rankSummary(alloc: Json): string {
  if (!alloc || typeof alloc !== 'object' || Array.isArray(alloc)) return '';
  return Object.entries(alloc).map(([k, v]) => `${k}×${v}`).join(', ');
}
