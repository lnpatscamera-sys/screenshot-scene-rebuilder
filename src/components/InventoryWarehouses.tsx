import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Plus, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { refreshInventory, warehouseName, type InventoryItem, type Warehouse, type WarehouseStock } from '@/lib/inventory';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/table';
import { ReportActions } from './Phase2Shared';

export function InventoryWarehouses({ items, warehouses, stock, canEdit }: { items: InventoryItem[]; warehouses: Warehouse[]; stock: WarehouseStock[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Warehouse> | null>(null);
  const [transfer, setTransfer] = useState<string | null>(null);
  const [itemId, setItemId] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const available = stock.find(s => s.item_id === itemId && s.warehouse_id === (from || null))?.quantity || 0;
  const report = stock.map(s => ({ Warehouse: warehouseName(warehouses, s.warehouse_id), Code: items.find(i => i.id === s.item_id)?.code, Item: items.find(i => i.id === s.item_id)?.name, Quantity: s.quantity }));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !editing) return;
    const f = new FormData(e.currentTarget); setBusy(true);
    try {
      const payload = { name: String(f.get('name') || '').trim(), location: String(f.get('location') || '').trim() };
      const result = editing.id ? await supabase.from('warehouses').update(payload).eq('id', editing.id).select('id').single() : await supabase.from('warehouses').insert(payload).select('id').single();
      if (result.error) throw result.error;
      await refreshInventory(qc); setEditing(null); toast.success('Warehouse saved');
    } catch (e) { toast.error((e as { message?: string }).message || 'Warehouse could not be saved'); } finally { setBusy(false); }
  }
  async function remove(w: Warehouse) {
    if (!window.confirm(`Delete ${w.name}? Warehouses linked to stock or history cannot be deleted.`)) return;
    const result = await supabase.from('warehouses').delete().eq('id', w.id).select('id').single();
    if (result.error) { toast.error(result.error.message); return; } await refreshInventory(qc); toast.success('Warehouse deleted');
  }
  async function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !transfer) return;
    const f = new FormData(e.currentTarget); setBusy(true);
    try {
      const result = await supabase.rpc('transfer_inventory', { _id: transfer, _item: itemId, _from: from || null, _to: String(f.get('to') || '') || null, _quantity: Number(f.get('quantity')), _reason: String(f.get('reason') || '') } as unknown as DatabaseTransfer);
      if (result.error) throw result.error;
      await refreshInventory(qc); setTransfer(null); toast.success('Stock transferred; total quantity unchanged');
    } catch (e) { toast.error((e as { message?: string }).message || 'Transfer could not be posted'); } finally { setBusy(false); }
  }
  return <section className="mt-8 border-t pt-6">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><h2 className="text-lg font-semibold">Warehouses & stock locations</h2><div className="flex flex-wrap gap-2"><ReportActions title="Warehouse stock" rows={report} />{canEdit && <><Button variant="outline" onClick={() => { setTransfer(crypto.randomUUID()); setItemId(''); setFrom(''); }}><ArrowRightLeft className="h-4 w-4" />Stock transfer</Button><Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />Add warehouse</Button></>}</div></div>
    <Table><TableHeader><TableRow><TableHead>Warehouse</TableHead><TableHead>Location</TableHead><TableHead>Items stocked</TableHead><TableHead>Stock value</TableHead>{canEdit && <TableHead>Actions</TableHead>}</TableRow></TableHeader><TableBody>{[{ id: null, name: 'Unallocated', location: '—' }, ...warehouses].map(w => {
      const balances = stock.filter(s => s.warehouse_id === w.id && s.quantity > 0);
      const value = balances.reduce((sum, s) => sum + s.quantity * Number(items.find(i => i.id === s.item_id)?.unit_cost || 0), 0);
      return <TableRow key={w.id || 'unallocated'}><TableCell>{w.name}</TableCell><TableCell>{w.location || '—'}</TableCell><TableCell>{balances.length}</TableCell><TableCell>{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>{canEdit && <TableCell>{w.id && <><Button variant="ghost" size="icon" title={`Edit ${w.name}`} aria-label={`Edit warehouse ${w.name}`} onClick={() => setEditing(warehouses.find(v => v.id === w.id) || null)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={`Delete ${w.name}`} aria-label={`Delete warehouse ${w.name}`} onClick={() => { const found = warehouses.find(v => v.id === w.id); if (found) void remove(found); }}><Trash2 className="h-4 w-4" /></Button></>}</TableCell>}</TableRow>;
    })}</TableBody></Table>
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Stock by warehouse</summary><Table><TableHeader><TableRow><TableHead>Warehouse</TableHead><TableHead>Code</TableHead><TableHead>Item</TableHead><TableHead>Stock</TableHead></TableRow></TableHeader><TableBody>{report.map((r, i) => <TableRow key={stock[i]?.id}><TableCell>{r.Warehouse}</TableCell><TableCell>{r.Code}</TableCell><TableCell>{r.Item}</TableCell><TableCell>{r.Quantity}</TableCell></TableRow>)}</TableBody></Table></details>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing?.id ? 'Edit warehouse' : 'Add warehouse'}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><div><Label htmlFor="warehouse-name">Warehouse name</Label><Input id="warehouse-name" name="name" required defaultValue={editing?.name} /></div><div><Label htmlFor="warehouse-location">Warehouse location</Label><Input id="warehouse-location" name="location" defaultValue={editing?.location || ''} /></div><Button disabled={busy}>{busy ? 'Saving…' : 'Save warehouse'}</Button></form></DialogContent></Dialog>
    <Dialog open={!!transfer} onOpenChange={open => { if (!open && !busy) setTransfer(null); }}><DialogContent><DialogHeader><DialogTitle>Stock transfer</DialogTitle></DialogHeader><form onSubmit={post} className="space-y-4"><div><Label htmlFor="transfer-item">Item</Label><select id="transfer-item" value={itemId} onChange={e => setItemId(e.target.value)} required className="w-full h-10 rounded-md border bg-background px-2"><option value="">Select item…</option>{items.map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="transfer-from">From warehouse</Label><select id="transfer-from" value={from} onChange={e => setFrom(e.target.value)} className="w-full h-10 rounded-md border bg-background px-2"><option value="">Unallocated</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><Label htmlFor="transfer-to">To warehouse</Label><select id="transfer-to" name="to" className="w-full h-10 rounded-md border bg-background px-2"><option value="">Unallocated</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div><p className="text-sm text-muted-foreground">Available in source: {available}</p><div><Label htmlFor="transfer-quantity">Quantity</Label><Input id="transfer-quantity" name="quantity" type="number" min={1} max={available} step={1} required /></div><div><Label htmlFor="transfer-reason">Reason</Label><Input id="transfer-reason" name="reason" required /></div><Button disabled={busy || !itemId}>{busy ? 'Posting…' : 'Post transfer'}</Button></form></DialogContent></Dialog>
  </section>;
}
type DatabaseTransfer = import('@/integrations/supabase/types').Database['public']['Functions']['transfer_inventory']['Args'];