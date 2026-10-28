import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { AppRole } from './auth';
import { liberiaDate } from '@/lib/time';

type Tables = Database['public']['Tables'];
export type Vendor = Tables['vendors']['Row'];
export type Requisition = Tables['procurement_funding']['Row'];
export type Quotation = Tables['quotations']['Row'];
export type PurchaseOrder = Tables['purchase_orders']['Row'];
export type OrderItem = Tables['purchase_order_items']['Row'];
export type GoodsNote = Tables['goods_received_notes']['Row'];
export type Contract = Tables['contracts']['Row'];
export type Performance = Tables['supplier_performance']['Row'];
export const VENDOR_CATEGORIES = ['Office Supplies', 'ICT Equipment', 'Vehicles', 'Construction', 'Training Materials', 'Medical Supplies', 'Uniforms', 'Fuel Suppliers', 'Equipment Maintenance'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];
export const PROCUREMENT_STAFF: AppRole[] = ['procurement_admin', 'procurement_officer'];
export const PROCUREMENT_READERS: AppRole[] = [...PROCUREMENT_STAFF, 'finance_admin', 'finance_officer', 'commandant', 'deputy_commandant', 'auditor', 'storekeeper'];
export const PROCUREMENT_TABLES = ['vendors', 'procurement_funding', 'request_items', 'quotations', 'quotation_comparisons', 'purchase_orders', 'purchase_order_items', 'goods_received_notes', 'contracts', 'supplier_performance', 'procurement_reports'];
export function lowestBid<T extends Pick<Quotation, 'id' | 'status' | 'quoted_amount' | 'delivery_days' | 'received_at'>>(rows: T[]): T | undefined {
  return rows.filter(q => q.status === 'Received' && q.quoted_amount !== null).sort((a, b) => Number(a.quoted_amount) - Number(b.quoted_amount) || Number(a.delivery_days) - Number(b.delivery_days) || String(a.received_at).localeCompare(String(b.received_at)))[0];
}
export function validDelivery(ordered: number, received: number, delivered: number, accepted: number, rejected: number) {
  return [ordered, received, delivered, accepted, rejected].every(n => Number.isInteger(n) && n >= 0) && delivered === accepted + rejected && accepted <= ordered - received;
}
export function supplierScore(ratings: (number | null)[]) {
  const values = ratings.filter((x): x is number => x !== null);
  return values.length ? Math.round(200 * values.reduce((a, b) => a + b, 0) / values.length) / 10 : null;
}
export function contractDays(end: string, today = new Date()) {
  return Math.ceil((Date.parse(end + 'T00:00:00Z') - Date.parse(liberiaDate() + 'T00:00:00Z')) / 86400000);
}
export function canOrderAction(roles: AppRole[], status: string | null, action: string) {
  const has = (allowed: AppRole[]) => roles.includes('system_admin') || allowed.some(r => roles.includes(r));
  if (action === 'approve') return status === 'Draft' && has(['procurement_admin', 'commandant']);
  if (action === 'send') return status === 'Approved' && has(PROCUREMENT_STAFF);
  if (action === 'cancel') return ['Draft', 'Approved', 'Sent'].includes(status ?? '') && has(['procurement_admin']);
  return false;
}
async function allRows<T>(load: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const r = await load(start, start + 999);
    if (r.error) throw new Error(r.error.message);
    rows.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) return rows;
  }
}
export const procurementOptions = queryOptions({ queryKey: ['procurement'], queryFn: async () => {
  const [vendors, requests, requestItems, quotations, comparisons, orders, orderItems, goods, contracts, performance, reports, approvals, sections, officers, inventory, warehouses, budgets, expenses, audit] = await Promise.all([
    allRows((a,b) => supabase.from('vendors').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('procurement_funding').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('request_items').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('quotations').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('quotation_comparisons').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('purchase_orders').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('purchase_order_items').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('goods_received_notes').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('contracts').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('supplier_performance').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('procurement_reports').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('finance_approvals').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('sections').select('id,name').order('id').range(a,b)),
    allRows((a,b) => supabase.from('officers').select('id,full_name,user_id,section_id').order('id').range(a,b)),
    allRows((a,b) => supabase.from('inventory_items').select('id,name,code,unit,quantity').order('id').range(a,b)),
    allRows((a,b) => supabase.from('warehouses').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('budgets').select('*').order('id').range(a,b)),
    allRows((a,b) => supabase.from('expenses').select('*').eq('expense_type', 'Procurement').order('id').range(a,b)),
    allRows((a,b) => supabase.from('audit_logs').select('*').in('table_name', PROCUREMENT_TABLES).order('id').range(a,b)),
  ]);
  return { vendors, requests, requestItems, quotations, comparisons, orders, orderItems, goods, contracts, performance, reports, approvals, sections, officers, inventory, warehouses, budgets, expenses, audit };
} });
export type ProcurementData = Awaited<ReturnType<NonNullable<typeof procurementOptions.queryFn>>>;
export const vendorName = (d: ProcurementData, id: string | null) => d.vendors.find(v => v.id === id)?.company_name ?? '—';
export const departmentName = (d: ProcurementData, id: string | null) => d.sections.find(s => s.id === id)?.name ?? '—';
export async function refreshProcurement(qc: QueryClient) {
  await Promise.all(['procurement','finance','inventory','warehouses','logistics','audit','notifications'].map(key => qc.invalidateQueries({ queryKey: [key] })));
}