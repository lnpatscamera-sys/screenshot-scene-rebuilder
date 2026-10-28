// Browser-safe enrollment rules shared by the HR form, sign-in page and server.
export const ENROLL_ROLES = ['hr_admin', 'hr_officer', 'system_admin'] as const;

export const normalizeLnpId = (v: string) => v.trim().toUpperCase();

export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Default password: 12 chars with upper, lower, digit and symbol. */
export function generatePassword(rand: (n: number) => number = (n) => {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] ?? 0) % n;
}) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*?'];
  const all = sets.join('');
  const chars = sets.map((s) => s[rand(s.length)]);
  while (chars.length < 12) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

export const passwordProblem = (p: string) =>
  p.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Include letters and numbers.' : null;
