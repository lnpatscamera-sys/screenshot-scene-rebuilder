import { describe, expect, it } from 'vitest';
import { canOrderAction, lowestBid, supplierScore, validDelivery, contractDays, PRIORITIES, VENDOR_CATEGORIES } from '@/lib/procurement';
import { PROCUREMENT_STAGE_ROLES } from '@/lib/finance';
describe('procurement rules', () => {
  it('allows Procurement Administrator at the Procurement approval level', () => expect(PROCUREMENT_STAGE_ROLES[2]).toEqual(['procurement_officer', 'procurement_admin']));
  it('uses the nine supplied vendor categories', () => expect(VENDOR_CATEGORIES).toEqual(['Office Supplies','ICT Equipment','Vehicles','Construction','Training Materials','Medical Supplies','Uniforms','Fuel Suppliers','Equipment Maintenance']));
  it('offers the four requested priorities', () => expect(PRIORITIES).toEqual(['Low','Medium','High','Emergency']));
  it('identifies the lowest received bidder with delivery as tie-breaker', () => {
    const bid = (id: string, status: string, price: number, days: number) => ({ id, status, quoted_amount: price, delivery_days: days, received_at: '2026-10-24' });
    expect(lowestBid([bid('pending','Requested',1,1),bid('slow','Received',100,10),bid('fast','Received',100,5),bid('costly','Received',200,1)])?.id).toBe('fast');
  });
  it('keeps delivered equal to accepted plus rejected', () => {
    expect(validDelivery(10, 0, 10, 8, 2)).toBe(true);
    expect(validDelivery(10, 0, 10, 8, 1)).toBe(false);
  });
  it('prevents acceptance above the outstanding quantity', () => { expect(validDelivery(10,8,3,3,0)).toBe(false); expect(validDelivery(10,8,3,2,1)).toBe(true); });
  it('scores all five supplier dimensions on a 100-point scale', () => { expect(supplierScore([5,4,3,5,3])).toBe(80); expect(supplierScore([5,null,3,null,null])).toBe(80); expect(supplierScore([null])).toBeNull(); });
  it('does not let auditors approve or send orders', () => { expect(canOrderAction(['auditor'],'Draft','approve')).toBe(false); expect(canOrderAction(['auditor'],'Approved','send')).toBe(false); });
  it('reserves draft order approval for administrators or the Commandant', () => { expect(canOrderAction(['procurement_officer'],'Draft','approve')).toBe(false); expect(canOrderAction(['procurement_admin'],'Draft','approve')).toBe(true); expect(canOrderAction(['commandant'],'Draft','approve')).toBe(true); expect(canOrderAction(['system_admin'],'Completed','approve')).toBe(false); });
  it('counts contract expiry in calendar days', () => expect(contractDays('2026-10-30',new Date('2026-10-24T23:26:00Z'))).toBe(6));
});