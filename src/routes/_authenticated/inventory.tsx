import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Pencil, Trash2, Plus, Package, AlertTriangle, PackageX, Clock, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/AppShell';
import { ReportActions } from '@/components/Phase2Shared';
import { InventoryWarehouses } from '@/components/InventoryWarehouses';
import { useAuth } from '@/lib/auth';
import { StockPosting } from '@/components/StockPosting';
import { StockAnalysis } from '@/components/StockAnalysis';
import { INVENTORY_CATEGORIES, inventoryOptions, inventorySummary, refreshInventory, warehouseOptions, warehouseName, type InventoryItem } from '@/lib/inventory';

export const Route = createFileRoute('/_authenticated/inventory')({
  head: () => ({ meta: [{ title: 'Inventory Management — LNPATS ERP' }, { name: 'description', content: 'Manage LNPATS inventory, warehouses, valuation, stock transfers and audited adjustments.' }, { property: 'og:title', content: 'Inventory Management — LNPATS ERP' }, { property: 'og:description', content: 'Manage LNPATS inventory, warehouses, valuation, stock transfers and audited adjustments.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(inventoryOptions), context.queryClient.ensureQueryData(warehouseOptions)]); },
  component: Inventory,
});

function Inventory() {
  const { hasAny } = useAuth(); const qc = useQueryClient();
  const { data } = useSuspenseQuery(inventoryOptions);
  const { data: { warehouses, stock } } = useSuspenseQuery(warehouseOptions);
  const [tab, setTab] = useState('all'); const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null);
  const [q, setQ] = useState(''); const [category, setCategory] = useState(''); const [warehouse, setWarehouse] = useState(''); const [busy, setBusy] = useState(false);
  const canEdit = hasAny(['storekeeper']); const summary = inventorySummary(data);
  const categories = Array.from(new Set([...INVENTORY_CATEGORIES, ...data.map(i => i.category)])).sort();
  const rows = data.filter(i => `${i.name} ${i.code} ${i.category} ${i.location || ''} ${warehouseName(warehouses, i.warehouse_id)}`.toLowerCase().includes(q.toLowerCase()) && (!category || i.category === category) && (!warehouse || stock.some(s => s.item_id === i.id && (s.warehouse_id || 'unallocated') === warehouse && s.quantity > 0)) && (tab === 'all' || tab === 'assets' && i.is_asset || tab === 'low' && i.quantity > 0 && i.quantity <= i.reorder_level || tab === 'out' && i.quantity === 0 || tab === 'recent' && Date.now() - Date.parse(i.created_at) <= 30 * 86400000));
  const format = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const report = rows.map(i => ({ Code: i.code, Item: i.name, Category: i.category, Stock: i.quantity, Unit: i.unit, Reorder: i.reorder_level, 'Unit cost': i.unit_cost, Value: Number((i.quantity * Number(i.unit_cost)).toFixed(2)), 'Default warehouse': warehouseName(warehouses, i.warehouse_id), Location: i.location || '', Added: i.created_at.slice(0, 10) }));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !editing) return;
    const f = new FormData(e.currentTarget); const text = (key: string) => String(f.get(key) || '');
    const metadata = { name: text('name').trim(), category: text('category'), unit: text('unit').trim(), reorder_level: Number(text('reorder_level')), unit_cost: Number(text('unit_cost')), location: text('location'), warehouse_id: text('warehouse_id') || null, is_asset: f.get('is_asset') === 'on', assigned_to: text('assigned_to') || null };
    setBusy(true);
    try {
      const result = editing.id ? await supabase.from('inventory_items').update(metadata).eq('id', editing.id).select('id').single() : await supabase.rpc('register_inventory', { _metadata: metadata, _quantity: Number(text('quantity')) });
      if (result.error) throw result.error; await refreshInventory(qc); setEditing(null); toast.success('Inventory item saved');
    } catch (e) { toast.error((e as { message?: string }).message || 'Item could not be saved'); } finally { setBusy(false); }
  }
  async function remove(i: InventoryItem) {
    if (!window.confirm(`Delete ${i.name}? Items with stock or movement history cannot be deleted.`)) return;
    const result = await supabase.from('inventory_items').delete().eq('id', i.id).select('id').single();
    if (result.error) { toast.error(result.error.message); return; } await refreshInventory(qc); toast.success('Item deleted');
  }
  return <div>
    <PageHeader title="Inventory Management" actions={<><ReportActions title="Inventory register" rows={report} />{canEdit && <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />Add item</Button>}</>} />
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 border-y py-5 mb-6">{[{ label: 'Total items', value: summary.total, icon: Package }, { label: 'Low stock items', value: summary.low, icon: AlertTriangle }, { label: 'Out of stock items', value: summary.out, icon: PackageX }, { label: 'Added in last 30 days', value: summary.recent, icon: Clock }, { label: 'Inventory value', value: format(summary.value), icon: Coins }].map(m => <div key={m.label}><div className="flex items-center gap-2 text-xs text-muted-foreground"><m.icon className="h-4 w-4 shrink-0" />{m.label}</div><div className="mt-2 text-2xl font-bold break-words">{m.value}</div></div>)}</div>
    <section className="mb-6"><h2 className="text-lg font-semibold mb-3">Category summary</h2><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8">{categories.map(c => { const items = data.filter(i => i.category === c); return <div key={c} className="flex items-center justify-between gap-3 border-b py-3 text-sm"><span>{c}</span><span className="shrink-0 text-muted-foreground">{items.length} items · {format(items.reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0))}</span></div>; })}</div></section>
    <div className="flex flex-wrap gap-3 mb-4"><Tabs value={tab} onValueChange={setTab} className="max-w-full overflow-x-auto"><TabsList><TabsTrigger value="all">All items</TabsTrigger><TabsTrigger value="assets">Assets</TabsTrigger><TabsTrigger value="low">Low stock</TabsTrigger><TabsTrigger value="out">Out of stock</TabsTrigger><TabsTrigger value="recent">Recent</TabsTrigger></TabsList></Tabs><Input aria-label="Search inventory" placeholder="Search items, codes, locations…" value={q} onChange={e => setQ(e.target.value)} className="sm:max-w-xs" /><select aria-label="Filter category" value={category} onChange={e => setCategory(e.target.value)} className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filter warehouse" value={warehouse} onChange={e => setWarehouse(e.target.value)} className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"><option value="">All warehouses</option><option value="unallocated">Unallocated</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
    <Table><TableHeader><TableRow><TableHead>QR</TableHead><TableHead>Code / item</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead><TableHead>Stock</TableHead><TableHead>Unit cost</TableHead><TableHead>Value</TableHead>{canEdit && <TableHead>Actions</TableHead>}</TableRow></TableHeader><TableBody>{rows.map(i => <TableRow key={i.id}><TableCell><QRCodeSVG value={`LNPATS-INV:${i.code}`} size={32} /></TableCell><TableCell><div className="font-mono text-xs text-muted-foreground">{i.code}</div><div className="font-medium">{i.name}</div>{i.is_asset && <div className="text-xs text-muted-foreground">Fixed asset</div>}</TableCell><TableCell>{i.category}</TableCell><TableCell><div>{warehouseName(warehouses, i.warehouse_id)}</div><div className="text-xs text-muted-foreground">{i.location}{i.assigned_to ? ` · ${i.assigned_to}` : ''}</div></TableCell><TableCell className={i.quantity <= i.reorder_level ? 'text-destructive' : ''}><div className="whitespace-nowrap font-semibold">{i.quantity} {i.unit}</div><div className="text-xs">{i.quantity === 0 ? 'Out of stock' : i.quantity <= i.reorder_level ? 'Reorder' : 'In stock'} · min {i.reorder_level}</div></TableCell><TableCell>{format(Number(i.unit_cost))}</TableCell><TableCell>{format(i.quantity * Number(i.unit_cost))}</TableCell>{canEdit && <TableCell className="whitespace-nowrap"><Button variant="ghost" size="icon" title={`Edit ${i.name}`} aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={`Delete ${i.name}`} aria-label={`Delete ${i.name}`} onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No matching inventory items.</TableCell></TableRow>}</TableBody></Table>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?.id ? 'Edit inventory item' : 'Add inventory item'}</DialogTitle></DialogHeader><form onSubmit={save} className="grid grid-cols-2 gap-3" key={editing?.id || 'new'}><div className="col-span-2"><Label htmlFor="item-code">Item code</Label><Input id="item-code" disabled value={editing?.code || 'Generated when saved'} /></div><div className="col-span-2"><Label htmlFor="item-name">Item name</Label><Input id="item-name" name="name" required defaultValue={editing?.name} /></div><div><Label htmlFor="item-category">Category</Label><select id="item-category" name="category" defaultValue={editing?.category || INVENTORY_CATEGORIES[0]} className="w-full h-9 rounded-md border bg-background px-2 text-sm">{categories.map(c => <option key={c}>{c}</option>)}</select></div><div><Label htmlFor="item-unit">Unit</Label><Input id="item-unit" name="unit" required defaultValue={editing?.unit || 'pcs'} /></div><div><Label htmlFor="item-quantity">{editing?.id ? 'Stock quantity' : 'Opening quantity'}</Label><Input id="item-quantity" name="quantity" type="number" step="1" min="0" required disabled={!!editing?.id} defaultValue={editing?.quantity || 0} /></div><div><Label htmlFor="item-reorder">Reorder level</Label><Input id="item-reorder" name="reorder_level" type="number" step="1" min="0" required defaultValue={editing?.reorder_level ?? 10} /></div><div><Label htmlFor="item-cost">Unit cost</Label><Input id="item-cost" name="unit_cost" type="number" step="0.01" min="0" required defaultValue={editing?.unit_cost || 0} /></div><div><Label htmlFor="item-warehouse">Default warehouse</Label><select id="item-warehouse" name="warehouse_id" defaultValue={editing?.warehouse_id || ''} className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option value="">Unallocated</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><Label htmlFor="item-location">Stock location / shelf</Label><Input id="item-location" name="location" defaultValue={editing?.location || ''} /></div><div><Label htmlFor="item-assigned">Assigned to</Label><Input id="item-assigned" name="assigned_to" defaultValue={editing?.assigned_to || ''} /></div><label className="col-span-2 flex items-center gap-2 text-sm"><input name="is_asset" type="checkbox" defaultChecked={editing?.is_asset} />Tracked fixed asset</label><Button disabled={busy} className="col-span-2">{busy ? 'Saving…' : 'Save item'}</Button></form></DialogContent></Dialog>
    <InventoryWarehouses items={data} warehouses={warehouses} stock={stock} canEdit={canEdit} />
    <StockPosting items={data} />
    <StockAnalysis items={data} />
  </div>;
}
