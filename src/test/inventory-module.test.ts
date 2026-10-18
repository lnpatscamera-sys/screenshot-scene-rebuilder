import { describe, expect, it } from 'vitest';
import { INVENTORY_CATEGORIES, inventorySummary } from '@/lib/inventory';
describe('inventory module', () => {
  it('includes all ten requested inventory categories', () => {
    expect([...INVENTORY_CATEGORIES]).toEqual(['Office Supplies', 'ICT Equipment', 'Training Equipment', 'Furniture', 'Uniforms', 'Security Equipment', 'Medical Supplies', 'Vehicle Parts', 'Cleaning Supplies', 'Maintenance Supplies']);
  });
  it('computes total items', () => { expect(inventorySummary([{ quantity: 4, reorder_level: 5, unit_cost: 3, created_at: '2026-10-18' }]).total).toBe(1); });
  it('counts positive stock at or below reorder and separates out of stock', () => {
    const items = [0, 4, 5, 6].map(quantity => ({ quantity, reorder_level: 5, unit_cost: 2, created_at: '2026-10-18' }));
    expect(inventorySummary(items).low).toBe(2); expect(inventorySummary(items).out).toBe(1);
  });
  it('values inventory from quantity and unit cost', () => { expect(inventorySummary([{ quantity: 4, reorder_level: 5, unit_cost: 3.25, created_at: '2026-10-18' }]).value).toBe(13); });
  it('recent items use the last 30 days', () => {
    const items = ['2026-10-18', '2026-09-01', '2026-11-01'].map(created_at => ({ quantity: 1, reorder_level: 0, unit_cost: 0, created_at }));
    expect(inventorySummary(items, Date.parse('2026-10-18')).recent).toBe(1);
  });
});