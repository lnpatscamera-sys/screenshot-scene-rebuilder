import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formValues } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { warehouseOptions, refreshInventory, warehouseName } from '@/lib/inventory';

type Item = { id: string; name: string; code: string; quantity: number; unit: string };
type Mode = "Receipt" | "Issue" | "Reconciliation";

export function StockPosting({ items, initialMode = "Receipt", showHistory = true }: { items: Item[]; initialMode?: Mode; showHistory?: boolean }) {
  const { hasAny } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [entryId, setEntryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState('default');
  const { data: warehouseData } = useQuery(warehouseOptions);
  const canPost = hasAny(["storekeeper"]);
  const canRead = hasAny(["storekeeper", "commandant"]);
  const { data: movements = [], isError, isPending } = useQuery({
    queryKey: ["inventory-movements"],
    enabled: canRead,
    queryFn: async () => {
      const result = await supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const selected = items.find(i => i.id === itemId);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !selected) return;
    const values = formValues(e.currentTarget);
    const quantity = Number(values.quantity);
    const warehouse = warehouseId === 'default' ? {} : { warehouse_id: warehouseId || null };
    if (!Number.isInteger(quantity) || quantity < (mode === "Reconciliation" ? 0 : 1)) {
      toast.error("Enter a valid whole quantity"); return;
    }
    setBusy(true);
    try {
      const result = mode === "Receipt"
        ? await supabase.from("store_receipts").insert({ id: entryId, item_id: selected.id, quantity, ...warehouse, receipt_number: values.reference || null, remarks: values.reason })
        : mode === "Issue"
          ? await supabase.from("store_issues").insert({ id: entryId, item_id: selected.id, quantity, ...warehouse, issue_number: values.reference || null, remarks: values.reason })
          : await supabase.from("stock_reconciliation").insert({ id: entryId, item_id: selected.id, counted_quantity: quantity, ...warehouse, reconciliation_number: values.reference || null, reason: values.reason });
      if (result.error) throw result.error;
      await refreshInventory(qc);
      setOpen(false);
      toast.success(`${mode} recorded; stock updated`);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message || "Stock entry could not be saved"); }
    finally { setBusy(false); }
  };

  if (!canRead) return null;
  return <section className="mt-8 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 className="text-lg font-semibold">{showHistory ? "Stock movements" : "Stock posting"}</h2>
      {canPost && <Button onClick={() => { setEntryId(crypto.randomUUID()); setItemId(""); setWarehouseId('default'); setOpen(true); }}>Record stock entry</Button>}
    </div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent><DialogHeader><DialogTitle>Record stock entry</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={v => { if (!busy) { setMode(v as Mode); setEntryId(crypto.randomUUID()); } }}>
          <TabsList className="w-full"><TabsTrigger value="Receipt">Receipt</TabsTrigger><TabsTrigger value="Issue">Issue</TabsTrigger><TabsTrigger value="Reconciliation">Reconciliation</TabsTrigger></TabsList>
        </Tabs>
        <form onSubmit={submit} className="space-y-4" key={mode}>
          <div className="space-y-1"><Label htmlFor="stock-item">Item</Label><select id="stock-item" name="item_id" value={itemId} onChange={e => setItemId(e.target.value)} required disabled={busy} className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option value="">Select item…</option>{items.map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select></div>
          {selected && <p className="text-sm text-muted-foreground">Current stock: {selected.quantity} {selected.unit}</p>}
          <div className="space-y-1"><Label htmlFor="stock-warehouse">Warehouse</Label><select id="stock-warehouse" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={busy} className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option value="default">Item default warehouse</option><option value="">Unallocated</option>{warehouseData?.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="stock-quantity">{mode === "Reconciliation" ? "Warehouse counted quantity" : "Quantity"}</Label><Input id="stock-quantity" name="quantity" type="number" step="1" min={mode === "Reconciliation" ? 0 : 1} required disabled={busy} /></div>
            <div className="space-y-1"><Label htmlFor="stock-reference">Reference</Label><Input id="stock-reference" name="reference" disabled={busy} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="stock-reason">Reason / remarks</Label><Input id="stock-reason" name="reason" required disabled={busy} /></div>
          <Button type="submit" className="w-full" disabled={busy || !selected}>{busy ? "Saving…" : "Save stock entry"}</Button>
        </form>
      </DialogContent>
    </Dialog>
    {showHistory && (isError ? <div className="flex items-center gap-3"><p className="text-sm text-destructive">Stock history could not be loaded.</p><Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["inventory-movements"] })}>Retry</Button></div>
      : isPending ? <p className="text-sm text-muted-foreground">Loading stock history…</p>
      : <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Entry</TableHead><TableHead>Warehouse</TableHead><TableHead>Change</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>Recorded by</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
        <TableBody>{movements.map(m => <TableRow key={m.id}><TableCell className="whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</TableCell><TableCell>{items.find(i => i.id === m.item_id)?.name || m.item_id}</TableCell><TableCell>{m.movement_type}</TableCell><TableCell>{warehouseName(warehouseData?.warehouses || [], m.warehouse_id)}{m.transfer_id ? ` → ${warehouseName(warehouseData?.warehouses || [], m.to_warehouse_id)}` : ''}</TableCell><TableCell>{(m.quantity ?? 0) > 0 ? "+" : ""}{m.quantity}</TableCell><TableCell>{m.balance_before}</TableCell><TableCell>{m.balance_after}</TableCell><TableCell className="font-mono text-xs">{m.actor_id || "Legacy"}</TableCell><TableCell>{m.remarks}</TableCell></TableRow>)}{movements.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">No stock movements recorded.</TableCell></TableRow>}</TableBody>
      </Table>)}
  </section>;
}