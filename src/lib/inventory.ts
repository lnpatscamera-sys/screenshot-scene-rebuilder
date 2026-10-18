import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const INVENTORY_CATEGORIES = ['Office Supplies', 'ICT Equipment', 'Training Equipment', 'Furniture', 'Uniforms', 'Security Equipment', 'Medical Supplies', 'Vehicle Parts', 'Cleaning Supplies', 'Maintenance Supplies'] as const;
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];
export type Warehouse = Database['public']['Tables']['warehouses']['Row'];
export type WarehouseStock = Database['public']['Tables']['warehouse_stock']['Row'];
export function inventorySummary(items: Pick<InventoryItem, 'quantity' | 'reorder_level' | 'unit_cost' | 'created_at'>[], now = Date.now()) {
  return { total: items.length, low: items.filter(i => i.quantity > 0 && i.quantity <= i.reorder_level).length, out: items.filter(i => i.quantity === 0).length, recent: items.filter(i => now - Date.parse(i.created_at) >= 0 && now - Date.parse(i.created_at) <= 30 * 86400000).length, value: items.reduce((total, i) => total + i.quantity * Number(i.unit_cost), 0) };
}
export const inventoryOptions = queryOptions({ queryKey: ['inventory'], queryFn: async () => {
  const items: InventoryItem[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('inventory_items').select('*').order('code').range(offset, offset + 999);
    if (result.error) throw result.error;
    items.push(...result.data);
    if (result.data.length < 1000) return items;
  }
} });
export const warehouseOptions = queryOptions({ queryKey: ['warehouses'], queryFn: async () => {
  const warehouses: Warehouse[] = []; const stock: WarehouseStock[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('warehouses').select('*').order('name').range(offset, offset + 999);
    if (result.error) throw result.error; warehouses.push(...result.data); if (result.data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('warehouse_stock').select('*').order('id').range(offset, offset + 999);
    if (result.error) throw result.error; stock.push(...result.data); if (result.data.length < 1000) break;
  }
  return { warehouses, stock };
} });
export function warehouseName(warehouses: Warehouse[], id: string | null) { return warehouses.find(w => w.id === id)?.name || 'Unallocated'; }
export async function refreshInventory(qc: { invalidateQueries: (options: { queryKey: string[] }) => Promise<unknown> }) {
  await Promise.all(['inventory', 'warehouses', 'inventory-movements', 'logistics', 'audit', 'supplies'].map(key => qc.invalidateQueries({ queryKey: [key] })));
}