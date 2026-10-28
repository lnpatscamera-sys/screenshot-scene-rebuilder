// Biometric attendance rules. Liberia (Africa/Monrovia) is GMT+0 with no daylight saving,
// so UTC hours equal Liberia wall-clock hours.
export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 16;
export const LATE_GRACE_MINUTES = 60;
/** Night-duty officers may sign out up to 08:00 the next day (plus grace). */
export const NIGHT_DUTY_CUTOFF_HOURS = 24 + WORK_START_HOUR + 4;
export const ATTENDANCE_ROLES = ['hr_officer', 'hr_admin', 'system_admin'] as const;
// Fixed-date Liberian public holidays (MM-DD). Movable holidays must be added by HR.
export const PUBLIC_HOLIDAYS = ['01-01', '02-11', '03-15', '05-14', '05-25', '07-26', '08-24', '11-29', '12-25'];
export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Early Departure', 'Absent', 'On Leave', 'Public Holiday'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type Punch = { officer_id: string | null; punched_at: string; direction: string; device_id: string };
export type RosterRow = { officer_id: string; date: string; time_in: string | null; time_out: string | null; hours: number | null; status: AttendanceStatus; device_id: string | null };

export function verifyMethod(mode: string | undefined | null): string {
  const m = (mode ?? '').toLowerCase();
  if (m.includes('face')) return 'Face';
  if (m.includes('finger')) return 'Fingerprint';
  if (m.includes('card')) return 'RFID Card';
  if (m.includes('pw') || m.includes('password')) return 'Password';
  return 'Fingerprint';
}

export function punchDirection(status: string | undefined | null): 'Check In' | 'Check Out' | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'checkout' || s === 'breakout' || s === 'overtimeout') return 'Check Out';
  if (s === 'checkin' || s === 'breakin' || s === 'overtimein') return 'Check In';
  return null;
}

export function isLate(checkIn: Date): boolean {
  return checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes() > WORK_START_HOUR * 60 + LATE_GRACE_MINUTES;
}

function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export function buildRoster(punches: Punch[], officerIds: string[], from: string, to: string, leave: { officer_id: string | null; start_date: string; end_date: string }[] = []): RosterRow[] {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  const rows: RosterRow[] = [];
  for (const officer of officerIds) {
    const mine = sorted.filter(p => p.officer_id === officer);
    for (const date of dayList(from, to)) {
      const dayStart = new Date(`${date}T00:00:00Z`).getTime();
      const checkIn = mine.find(p => p.direction === 'Check In' && p.punched_at.slice(0, 10) === date);
      if (!checkIn) {
        const weekday = new Date(dayStart).getUTCDay();
        const status: AttendanceStatus | null = PUBLIC_HOLIDAYS.includes(date.slice(5)) ? 'Public Holiday'
          : leave.some(l => l.officer_id === officer && l.start_date <= date && l.end_date >= date) ? 'On Leave'
          : weekday === 0 || weekday === 6 ? null : 'Absent';
        if (status) rows.push({ officer_id: officer, date, time_in: null, time_out: null, hours: null, status, device_id: null });
        continue;
      }
      const inAt = new Date(checkIn.punched_at);
      const limit = dayStart + NIGHT_DUTY_CUTOFF_HOURS * 3600_000;
      const nextIn = mine.find(p => p.direction === 'Check In' && p.punched_at > checkIn.punched_at && p.punched_at.slice(0, 10) !== date);
      const outs = mine.filter(p => p.direction === 'Check Out' && p.punched_at > checkIn.punched_at && new Date(p.punched_at).getTime() <= limit && (!nextIn || p.punched_at < nextIn.punched_at));
      const out = outs[outs.length - 1];
      const outAt = out ? new Date(out.punched_at) : null;
      const early = !!outAt && outAt.getTime() < dayStart + WORK_END_HOUR * 3600_000;
      const status: AttendanceStatus = isLate(inAt) ? 'Late' : early ? 'Early Departure' : 'Present';
      rows.push({ officer_id: officer, date, time_in: checkIn.punched_at, time_out: out?.punched_at ?? null, hours: outAt ? Math.round(((outAt.getTime() - inAt.getTime()) / 3600_000) * 100) / 100 : null, status, device_id: checkIn.device_id });
    }
  }
  return rows;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
