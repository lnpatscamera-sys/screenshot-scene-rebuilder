import { describe, it, expect } from 'vitest';
import { categorySections, emailSubject, nearingRetirement } from '@/lib/hr-enrollment';
describe('HR enrollment rules', () => {
  it('recruits get probation, not in-service fields', () => { expect(categorySections('Newly Recruited Officer')).toEqual({ probation: true, initialAssignment: true, inService: false }); });
  it('in-service officers hide probation', () => { expect(categorySections('In-Service Officer')).toEqual({ probation: false, initialAssignment: false, inService: true }); });
  it('email subjects by category', () => { expect(emailSubject('Newly Recruited Officer')).toBe('Welcome to LNPATS'); expect(emailSubject('In-Service Officer')).toBe('Personnel Record Enrollment Confirmation'); });
  it('retirement within 12 months', () => { const now = new Date('2026-01-01'); expect(nearingRetirement('2026-06-01', now)).toBe(true); expect(nearingRetirement('2027-06-01', now)).toBe(false); });
});

import { retirementDateFor, retirementSummary, photoError } from '@/lib/hr-enrollment';
describe('personnel form rules', () => {
  it('retirement eligibility is date of birth + 65 years', () => { expect(retirementDateFor('1972-05-04')).toBe('2037-05-04'); });
  it('age and years remaining', () => { expect(retirementSummary('1983-06-25', '2026-10-30')).toEqual({ age: 43, remaining: 22, date: '2048-06-25' }); });
  it('photo must be JPG/PNG up to 5 MB', () => { expect(photoError({ type: 'image/gif', size: 10 })).toMatch(/JPG/); expect(photoError({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/); expect(photoError({ type: 'image/jpeg', size: 1000 })).toBeNull(); });
  it('accepts JPG/PNG files with no reported type by extension', () => { expect(photoError({ type: '', size: 1000, name: 'me.JPG' })).toBeNull(); expect(photoError({ type: '', size: 1000, name: 'me.gif' })).toMatch(/JPG/); });
});
