export const REPORT_LEVELS = ['Immediate Supervisor', 'Section Head', 'Department Head', 'Deputy Commandant', 'Commandant'];
export const COMMAND_SUPPLY_LEVELS = ['Immediate Supervisor', 'Section Head', 'Department Head', 'Deputy Commandant Administration', 'Commandant'];
export { liberiaDate } from '@/lib/time';
import { liberiaDate } from '@/lib/time';
export function reportAlertHour(now: Date): number | null {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Monrovia', weekday: 'short' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Monrovia', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= 15 && hour <= 18 ? hour : null;
}
export function commandStockStatus(quantity: number, minimum: number) {
  return quantity === 0 ? 'Out Of Stock' : quantity <= minimum / 2 ? 'Critical Stock' : quantity <= minimum ? 'Low Stock' : 'Normal';
}