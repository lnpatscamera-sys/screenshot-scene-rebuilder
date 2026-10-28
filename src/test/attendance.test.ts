import { describe, expect, it } from 'vitest';
import { buildRoster, isLate } from '@/lib/attendance';

const p = (at: string, direction: string) => ({ officer_id: 'o1', punched_at: at, direction, device_id: 'd1' });

describe('biometric attendance rules', () => {
  it('9:00 is on time, 9:01 is late (60 minute grace)', () => {
    expect(isLate(new Date('2026-10-28T09:00:00Z'))).toBe(false);
    expect(isLate(new Date('2026-10-28T09:01:00Z'))).toBe(true);
  });
  it('leaving before 4 PM is an early departure', () => {
    const [r] = buildRoster([p('2026-10-28T08:00:00Z', 'Check In'), p('2026-10-28T15:30:00Z', 'Check Out')], ['o1'], '2026-10-28', '2026-10-28');
    expect(r?.status).toBe('Early Departure');
  });
  it('night duty sign-out at 8 AM next day belongs to the same shift', () => {
    const rows = buildRoster([p('2026-10-28T08:00:00Z', 'Check In'), p('2026-10-29T08:00:00Z', 'Check Out')], ['o1'], '2026-10-28', '2026-10-28');
    expect(rows[0]?.hours).toBe(24);
    expect(rows[0]?.status).toBe('Present');
  });
  it('no sign-in on a weekday is Absent, or On Leave when leave is approved', () => {
    expect(buildRoster([], ['o1'], '2026-10-28', '2026-10-28')[0]?.status).toBe('Absent');
    expect(buildRoster([], ['o1'], '2026-10-28', '2026-10-28', [{ officer_id: 'o1', start_date: '2026-10-27', end_date: '2026-10-30' }])[0]?.status).toBe('On Leave');
  });
});
