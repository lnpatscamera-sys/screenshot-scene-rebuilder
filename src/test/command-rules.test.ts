import { describe, it, expect } from 'vitest';
import { REPORT_LEVELS, COMMAND_SUPPLY_LEVELS, commandStockStatus, reportAlertHour, liberiaDate } from '../lib/command-rules';
describe('Command reporting requirements', () => {
 it('uses the five named report reviewers in order', () => expect(REPORT_LEVELS).toEqual(['Immediate Supervisor','Section Head','Department Head','Deputy Commandant','Commandant']));
 it('uses Deputy Commandant Administration for supply approval', () => expect(COMMAND_SUPPLY_LEVELS).toEqual(['Immediate Supervisor','Section Head','Department Head','Deputy Commandant Administration','Commandant']));
 it('reminds at 3 PM Liberia time on weekdays', () => expect(reportAlertHour(new Date('2026-10-26T15:00:00Z'))).toBe(15));
 it('sends the second reminder at 4 PM', () => expect(reportAlertHour(new Date('2026-10-26T16:00:00Z'))).toBe(16));
 it('marks the 5 PM overdue window', () => expect(reportAlertHour(new Date('2026-10-26T17:00:00Z'))).toBe(17));
 it('escalates in the 6 PM window', () => expect(reportAlertHour(new Date('2026-10-26T18:00:00Z'))).toBe(18));
 it('does not send weekend alerts', () => expect(reportAlertHour(new Date('2026-10-24T17:00:00Z'))).toBeNull());
 it('does not send before 3 PM', () => expect(reportAlertHour(new Date('2026-10-26T14:00:00Z'))).toBeNull());
 it('uses Monrovia reporting dates', () => expect(liberiaDate(new Date('2026-10-26T00:30:00Z'))).toBe('2026-10-26'));
 it('distinguishes normal, low, critical and out-of-stock levels', () => { expect(commandStockStatus(11,10)).toBe('Normal'); expect(commandStockStatus(10,10)).toBe('Low Stock'); expect(commandStockStatus(5,10)).toBe('Critical Stock'); expect(commandStockStatus(0,10)).toBe('Out Of Stock'); });
});