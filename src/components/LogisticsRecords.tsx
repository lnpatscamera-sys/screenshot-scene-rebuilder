import { useState } from 'react';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { validBooking } from '@/lib/logistics';
import { PageHeader } from './AppShell';
import { ReportActions } from './Phase2Shared';
import { StockPosting } from './StockPosting';
import { StockAnalysis } from './StockAnalysis';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export type LogisticsKind = 'movements' | 'receipts' | 'issues' | 'suppliers' | 'assets' | 'bookings';
const config = {
  movements: { title: 'Stock movements', table: 'inventory_movements', fields: ['created_at','item_id','movement_type','quantity','balance_before','balance_after','remarks'] },
  receipts: { title: 'Store receipts', table: 'store_receipts', fields: ['receipt_number','receipt_date','item_id','quantity','balance_before','balance_after','remarks'] },
  issues: { title: 'Store issues', table: 'store_issues', fields: ['issue_number','issue_date','item_id','quantity','balance_before','balance_after','remarks'] },
  suppliers: { title: 'Suppliers', table: 'suppliers', fields: ['company_name','contact_person','phone','email','address'] },
  assets: { title: 'Asset register', table: 'assets', fields: ['asset_number','asset_name','category','assigned_to','condition','purchase_date','value'] },
  bookings: { title: 'Vehicle bookings', table: 'vehicle_bookings', fields: ['vehicle_id','requested_by','driver_id','start_at','end_at','destination','purpose','status','remarks'] },
} as const;
type Row = Record<string, unknown> & { id: string };
export const logisticsOptions = (kind: LogisticsKind) => queryOptions({ queryKey: ['logistics', kind], queryFn: async () => {
  const permission = await supabase.rpc('has_any_role', { _user_id: (await supabase.auth.getUser()).data.user?.id || '', _roles: ['storekeeper','commandant'] });
  if (permission.error || !permission.data) throw new Error('You do not have access to logistics management.');
  const [records, items, vehicles, officers] = await Promise.all([
    supabase.from(config[kind].table).select('*').limit(1000),
    supabase.from('inventory_items').select('id,name,code,quantity,unit').order('code'),
    supabase.from('vehicles').select('id,vehicle_no').order('vehicle_no'),
    supabase.from('officers').select('id,full_name').order('full_name'),
  ]);
  if (records.error || items.error || vehicles.error || officers.error) throw new Error('Logistics records could not be loaded.');
  return { records: records.data as unknown as Row[], items: items.data, vehicles: vehicles.data, officers: officers.data };
} });

export function LogisticsRecords({ kind }: { kind: LogisticsKind }) {
  const { data } = useSuspenseQuery(logisticsOptions(kind));
  const { hasAny, roles } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const cfg = config[kind];
  const admin = roles.includes('system_admin');
  const mutable = admin && ['suppliers','assets','bookings'].includes(kind);
  const rows = data.records.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const display = (field: string, value: unknown) => {
    if (field === 'item_id') return data.items.find(i => i.id === value)?.name || String(value || '—');
    if (field === 'vehicle_id') return data.vehicles.find(i => i.id === value)?.vehicle_no || String(value || '—');
    if (['assigned_to','requested_by','driver_id'].includes(field)) return data.officers.find(i => i.id === value)?.full_name || '—';
    return String(value ?? '—');
  };
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !editing || !mutable) return;
    const values = new FormData(e.currentTarget);
    const f = { company_name: String(values.get('company_name') || ''), contact_person: String(values.get('contact_person') || ''), phone: String(values.get('phone') || ''), email: String(values.get('email') || ''), address: String(values.get('address') || ''), asset_number: String(values.get('asset_number') || ''), asset_name: String(values.get('asset_name') || ''), category: String(values.get('category') || ''), assigned_to: String(values.get('assigned_to') || ''), condition: String(values.get('condition') || ''), purchase_date: String(values.get('purchase_date') || ''), value: String(values.get('value') || ''), start_at: String(values.get('start_at') || ''), end_at: String(values.get('end_at') || ''), vehicle_id: String(values.get('vehicle_id') || ''), requested_by: String(values.get('requested_by') || ''), driver_id: String(values.get('driver_id') || ''), destination: String(values.get('destination') || ''), purpose: String(values.get('purpose') || ''), status: String(values.get('status') || ''), remarks: String(values.get('remarks') || '') };
    setBusy(true);
    try {
      let result;
      if (kind === 'suppliers') {
        const payload = { company_name: f.company_name, contact_person: f.contact_person, phone: f.phone, email: f.email, address: f.address };
        result = editing.id ? await supabase.from('vendors').update(payload).eq('id', editing.id).select('id').single() : await supabase.from('vendors').insert(payload).select('id').single();
      } else if (kind === 'assets') {
        const payload = { asset_number: f.asset_number, asset_name: f.asset_name, category: f.category, assigned_to: f.assigned_to || null, condition: f.condition, purchase_date: f.purchase_date || null, value: f.value ? Number(f.value) : null };
        result = editing.id ? await supabase.from('assets').update(payload).eq('id', editing.id).select('id').single() : await supabase.from('assets').insert(payload).select('id').single();
      } else {
        if (!validBooking(f.start_at, f.end_at)) throw new Error('End time must be after start time.');
        const payload = { vehicle_id: f.vehicle_id, requested_by: f.requested_by || null, driver_id: f.driver_id || null, start_at: new Date(f.start_at).toISOString(), end_at: new Date(f.end_at).toISOString(), destination: f.destination, purpose: f.purpose, status: f.status, remarks: f.remarks };
        result = editing.id ? await supabase.from('vehicle_bookings').update(payload).eq('id', editing.id).select('id').single() : await supabase.from('vehicle_bookings').insert(payload).select('id').single();
      }
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ['logistics',kind] }); setEditing(null); toast.success('Record saved');
    } catch (error) { toast.error((error as {message?: string}).message || 'Record could not be saved'); } finally { setBusy(false); }
  }
  async function remove(row: Row) {
    if (!mutable || !window.confirm('Delete this record?')) return;
    const table = kind === 'suppliers' ? 'vendors' : kind === 'assets' ? 'assets' : 'vehicle_bookings';
    const result = await supabase.from(table).delete().eq('id',row.id).select('id');
    if (result.error || !result.data?.length) { toast.error(result.error?.message || 'Record could not be deleted'); return; }
    await qc.invalidateQueries({ queryKey: ['logistics',kind] }); toast.success('Record deleted');
  }
  const stock = ['movements','receipts','issues'].includes(kind);
  return <div><PageHeader title={cfg.title} actions={<><ReportActions title={cfg.title} rows={rows.map(r => Object.fromEntries(cfg.fields.map(f => [f,display(f,r[f])])))} />{mutable && <Button onClick={() => setEditing({id:''})}><Plus className="h-4 w-4" />New record</Button>}</>} />
    <Input aria-label="Search records" placeholder="Search records…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />
    <Table><TableHeader><TableRow>{cfg.fields.map(f => <TableHead key={f} className="whitespace-nowrap capitalize">{f.replaceAll('_',' ')}</TableHead>)}{mutable && <TableHead>Actions</TableHead>}</TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id}>{cfg.fields.map(f => <TableCell key={f} className="max-w-xs break-words">{display(f,r[f])}</TableCell>)}{mutable && <TableCell className="whitespace-nowrap"><Button variant="ghost" size="icon" aria-label="Edit record" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete record" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button></TableCell>}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={cfg.fields.length + 1} className="text-muted-foreground">No records found.</TableCell></TableRow>}</TableBody></Table>
    {stock && hasAny(['storekeeper']) && <StockPosting items={data.items} initialMode={kind === 'issues' ? 'Issue' : 'Receipt'} />}
    {kind === 'movements' && <StockAnalysis items={data.items} />}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'New'} {kind === 'bookings' ? 'vehicle booking' : kind === 'assets' ? 'asset' : 'supplier'}</DialogTitle></DialogHeader><form onSubmit={save} className="grid sm:grid-cols-2 gap-3">{cfg.fields.map(f => {
      const options = f === 'vehicle_id' ? data.vehicles.map(v => ({id:v.id,label:v.vehicle_no})) : ['assigned_to','requested_by','driver_id'].includes(f) ? data.officers.map(v => ({id:v.id,label:v.full_name})) : null;
      const dateTime = f.endsWith('_at');
      const defaultValue = editing?.[f] == null ? '' : dateTime ? String(editing[f]).slice(0,16) : String(editing[f]);
      return <div key={f} className="space-y-1"><Label htmlFor={`edit-${f}`} className="capitalize">{f.replaceAll('_',' ')}</Label>{options ? <select id={`edit-${f}`} name={f} defaultValue={defaultValue} required={f === 'vehicle_id'} className="h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="">Select…</option>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select> : f === 'status' ? <select id={`edit-${f}`} name={f} defaultValue={defaultValue || 'Pending'} className="h-10 w-full rounded-md border bg-background px-2 text-sm">{['Pending','Approved','Completed','Cancelled'].map(s => <option key={s}>{s}</option>)}</select> : <Input id={`edit-${f}`} name={f} defaultValue={defaultValue} type={dateTime ? 'datetime-local' : f === 'purchase_date' ? 'date' : f === 'value' ? 'number' : f === 'email' ? 'email' : 'text'} min={f === 'value' ? 0 : undefined} required={['company_name','asset_name','start_at','end_at','destination','purpose'].includes(f)} />}</div>;
    })}<Button className="sm:col-span-2" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</Button></form></DialogContent></Dialog>
  </div>;
}