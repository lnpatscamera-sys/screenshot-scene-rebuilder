import { describe, it, expect } from 'vitest';
import { canAnalyzeStock, validBooking, stockAnalysisInput } from '@/lib/logistics';
describe('protected logistics analysis', () => {
  it('inventory staff and system administrators can analyze', () => { expect(canAnalyzeStock(['storekeeper'])).toBe(true); expect(canAnalyzeStock(['system_admin'])).toBe(true); });
  it('officers and read-only commandant cannot analyze', () => { expect(canAnalyzeStock(['officer'])).toBe(false); expect(canAnalyzeStock(['commandant'])).toBe(false); });
  it('rejects invalid item IDs and empty discrepancy evidence', () => { expect(stockAnalysisInput.safeParse({itemId:'not-an-id',description:'missing'}).success).toBe(false); });
  it('booking end must be after start', () => { expect(validBooking('2026-10-18T10:00','2026-10-18T11:00')).toBe(true); expect(validBooking('2026-10-18T10:00','2026-10-18T09:00')).toBe(false); });
});