import { formValues } from "@/lib/export";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory & Assets — LNPATS ERP" }] }),
  component: Inventory,
});

function Inventory() {
  const { hasAny } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await supabase.from("inventory_items").select("*").order("code")).data ?? [],
  });
  const canEdit = hasAny(["storekeeper"]);
  let rows = data.filter((i) => `${i.name} ${i.code} ${i.category}`.toLowerCase().includes(q.toLowerCase()));
  if (tab === "assets") rows = rows.filter((i) => i.is_asset);
  if (tab === "consumables") rows = rows.filter((i) => !i.is_asset);
  if (tab === "low") rows = rows.filter((i) => !i.is_asset && i.quantity <= i.reorder_level);

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    const { error } = await supabase.from("inventory_items").insert({
      code: f.code, name: f.name, category: f.category, unit: f.unit, quantity: Number(f.quantity), reorder_level: Number(f.reorder_level),
      location: f.location, is_asset: f.category === "Equipment" && f.is_asset === "on", assigned_to: f.assigned_to || null,
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };
  const adjust = async (id: string, qty: number, delta: number) => {
    const { error } = await supabase.from("inventory_items").update({ quantity: Math.max(0, qty + delta) }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  return (
    <div>
      <PageHeader
        title="Inventory & Asset Register"
        subtitle="Stores ledger with QR tracking — stock updates automatically on collection"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv("store-ledger.csv", rows.map(({ id, created_at, ...r }) => r))}>Export ledger</Button>
            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>Add item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New inventory item</DialogTitle></DialogHeader>
                  <form onSubmit={add} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Code</Label><Input name="code" required /></div>
                    <div className="space-y-1"><Label>Name</Label><Input name="name" required /></div>
                    <div className="space-y-1"><Label>Category</Label>
                      <select name="category" className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option>Office Supply</option><option>Consumable</option><option>Equipment</option></select>
                    </div>
                    <div className="space-y-1"><Label>Unit</Label><Input name="unit" defaultValue="pcs" /></div>
                    <div className="space-y-1"><Label>Quantity</Label><Input name="quantity" type="number" defaultValue={0} /></div>
                    <div className="space-y-1"><Label>Reorder level</Label><Input name="reorder_level" type="number" defaultValue={10} /></div>
                    <div className="space-y-1"><Label>Location</Label><Input name="location" /></div>
                    <div className="space-y-1"><Label>Assigned to</Label><Input name="assigned_to" /></div>
                    <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="is_asset" /> Tracked fixed asset</label>
                    <Button className="col-span-2">Save</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="consumables">Consumables</TabsTrigger><TabsTrigger value="assets">Assets</TabsTrigger><TabsTrigger value="low">Low stock</TabsTrigger></TabsList>
        </Tabs>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>QR</TableHead><TableHead>Code</TableHead><TableHead>Item</TableHead><TableHead className="hidden md:table-cell">Category</TableHead><TableHead className="hidden md:table-cell">Location / Assigned</TableHead><TableHead>Stock</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => {
              const low = !i.is_asset && i.quantity <= i.reorder_level;
              return (
                <TableRow key={i.id}>
                  <TableCell><QRCodeSVG value={`LNPATS-INV:${i.code}`} size={36} /></TableCell>
                  <TableCell className="font-mono text-xs">{i.code}</TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{i.is_asset ? "Asset" : i.category}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{i.location}{i.assigned_to ? ` · ${i.assigned_to}` : ""}</TableCell>
                  <TableCell>
                    <span className={low ? "text-destructive font-semibold" : ""}>{i.quantity} {i.unit}</span>
                    {low && <div className="text-[10px] text-destructive">Reorder (≤{i.reorder_level})</div>}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => adjust(i.id, i.quantity, -1)}>−</Button>{" "}
                      <Button size="sm" variant="outline" onClick={() => adjust(i.id, i.quantity, 1)}>+</Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
