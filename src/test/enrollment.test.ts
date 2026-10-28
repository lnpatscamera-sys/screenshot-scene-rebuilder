import { describe, expect, it } from 'vitest';
import { generatePassword, looksLikeEmail, normalizeLnpId, passwordProblem, ENROLL_ROLES } from '@/lib/enrollment';
describe('staff enrollment rules', () => {
  it('only HR and system admins enroll', () => expect([...ENROLL_ROLES].sort()).toEqual(['hr_admin', 'hr_officer', 'system_admin']));
  it('default password has 12 chars with every class', () => {
    for (let i = 0; i < 50; i++) { const p = generatePassword(); expect(p).toHaveLength(12); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/\d/); expect(p).toMatch(/[!@#$%*?]/); }
  });
  it('LNP ID username is case-insensitive', () => expect(normalizeLnpId(' lnp-123 ')).toBe('LNP-123'));
  it('distinguishes email from LNP ID', () => { expect(looksLikeEmail('a@b.com')).toBe(true); expect(looksLikeEmail('LNP-123')).toBe(false); });
  it('rejects weak new passwords', () => { expect(passwordProblem('short1')).not.toBeNull(); expect(passwordProblem('abcdefgh')).not.toBeNull(); expect(passwordProblem('abcdefg1')).toBeNull(); });
});
