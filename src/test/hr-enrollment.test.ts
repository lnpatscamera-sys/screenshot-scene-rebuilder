import { describe, it, expect } from 'vitest';
import { categorySections, emailSubject, nearingRetirement } from '@/lib/hr-enrollment';
describe('HR enrollment rules', () => {
  it('recruits get probation, not in-service fields', () => { expect(categorySections('Newly Recruited Officer')).toEqual({ probation: true, initialAssignment: true, inService: false }); });
  it('in-service officers hide probation', () => { expect(categorySections('In-Service Officer')).toEqual({ probation: false, initialAssignment: false, inService: true }); });
  it('email subjects by category', () => { expect(emailSubject('Newly Recruited Officer')).toBe('Welcome to LNPATS'); expect(emailSubject('In-Service Officer')).toBe('Personnel Record Enrollment Confirmation'); });
  it('retirement within 12 months', () => { const now = new Date('2026-01-01'); expect(nearingRetirement('2026-06-01', now)).toBe(true); expect(nearingRetirement('2027-06-01', now)).toBe(false); });
});
