import { describe, expect, it } from 'vitest';
import { grantableAppointmentRoles, rankSummary } from '@/lib/appointments';

describe('appointments', () => {
  it('never offers System Administrator through HR appointments', () => {
    expect(grantableAppointmentRoles()).not.toContain('system_admin');
    expect(grantableAppointmentRoles()).toContain('facility_manager');
  });
  it('summarizes rank allocations', () => {
    expect(rankSummary({ 'C/INSP': 1, INSP: 2 })).toBe('C/INSP×1, INSP×2');
  });
});
