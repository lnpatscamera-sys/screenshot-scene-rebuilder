import { formValues } from "@/lib/export";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { SUPPLY_ACTION_LABEL, SUPPLY_STAGES, SUPPLY_STAGE_ROLES } from "@/lib/workflow";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/supplies")({
  head: () => ({ meta: [{ title: "Supply Requests — LNPATS ERP" }] }),
  component: Supplies,
});

function Supplies() {
  const { session, hasAny } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "open">("all");
  const { data } = useQuery({
    queryKey: ["supplies"],
    queryFn: async () => {
      const [r, s, i] = await Promise.all([
        supabase.from("supply_requests").select("*, sections(name)").order("created_at", { ascending: false }),
        supabase.from("sections").select("id,name").order("name"),
        supabase.from("inventory_items").select("id,name,unit,quantity").order("name"),
      ]);
      return { reqs: r.data ?? [], sections: s.data ?? [], items: i.data ?? [] };
    },
  });
  const canSubmit = hasAny(["section_head"]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    const item = data?.items.find((i) => i.id === f.item_id);
    const { error } = await supabase.from("supply_requests").insert({
      section_id: f.section_id, item_id: item?.id ?? null, item_name: item?.name ?? f.item_name, description: f.description,
      quantity: Number(f.quantity), unit: item?.unit ?? "pcs", priority: f.priority, justification: f.justification,
      requested_by: session!.user.id, requested_by_name: f.requested_by_name,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted to Assistant Commissioner");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["supplies"] });
  };

  const act = async (id: string, approve: boolean) => {
    const note = approve ? null : prompt("Reason for rejection?");
    const { error } = await supabase.rpc("act_on_supply", { _id: id, _approve: approve, _note: note ?? undefined });
    if (error) { toast.error(error.message); return; }
    toast.success("Request updated");
    qc.invalidateQueries({ queryKey: ["supplies"] });
  };

  let reqs = data?.reqs ?? [];
  if (filter === "mine") reqs = reqs.filter((r) => r.approval_status !== "Rejected" && r.stage < 8 && hasAny(SUPPLY_STAGE_ROLES[r.stage] ?? []));
  if (filter === "open") reqs = reqs.filter((r) => r.approval_status !== "Rejected" && r.stage < 8);

  return (
    <div>
      <PageHeader
        title="Equipment & Supply Requests"
        subtitle="Section Head → AC → DC → Commandant → DC forwards → Logistics → Storekeeper → Collection"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv("supply-requests.csv", reqs.map((r) => ({ number: r.request_number, date: r.request_date, section: r.sections?.name, requested_by: r.requested_by_name, item: r.item_name, qty: r.quantity, unit: r.unit, priority: r.priority, approval: r.approval_status, collection: r.collection_status })))}>Export</Button>
            {canSubmit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New request</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Supply request form</DialogTitle></DialogHeader>
                  <form onSubmit={submit} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2"><Label>Requesting section</Label>
                      <select name="section_id" required className="w-full h-9 rounded-md border bg-background px-2 text-sm">{data?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </div>
                    <div className="space-y-1 col-span-2"><Label>Requested by</Label><Input name="requested_by_name" required /></div>
                    <div className="space-y-1 col-span-2"><Label>Item</Label>
                      <select name="item_id" required className="w-full h-9 rounded-md border bg-background px-2 text-sm">{data?.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} in stock)</option>)}</select>
                    </div>
                    <div className="space-y-1"><Label>Quantity</Label><Input name="quantity" type="number" min={1} required /></div>
                    <div className="space-y-1"><Label>Priority</Label>
                      <select name="priority" defaultValue="Normal" className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select>
                    </div>
                    <div className="space-y-1 col-span-2"><Label>Description</Label><Input name="description" /></div>
                    <div className="space-y-1 col-span-2"><Label>Justification</Label><Textarea name="justification" rows={2} required /></div>
                    <Button className="col-span-2">Submit request</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />
      <div className="flex gap-2 mb-4">
        {(["all", "open", "mine"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "mine" ? "Awaiting me" : f === "open" ? "Open" : "All"}</Button>
        ))}
      </div>
      <div className="grid gap-3">
        {reqs.length === 0 && <p className="text-muted-foreground text-sm">No requests here.</p>}
        {reqs.map((r) => {
          const closed = r.approval_status === "Rejected" || r.stage >= 8;
          const mine = !closed && hasAny(SUPPLY_STAGE_ROLES[r.stage] ?? []);
          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{r.request_number}</span><StatusBadge value={r.priority} /></div>
                    <div className="font-medium mt-1">{r.quantity} {r.unit} · {r.item_name}</div>
                    <div className="text-xs text-muted-foreground">{r.sections?.name} Section · {r.requested_by_name} · {r.request_date}</div>
                    {r.justification && <div className="text-xs mt-1">{r.justification}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2"><StatusBadge value={r.approval_status} /><StatusBadge value={r.collection_status} /></div>
                    {mine && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => act(r.id, true)}>{SUPPLY_ACTION_LABEL[r.stage]}</Button>
                        {r.stage <= 3 && <Button size="sm" variant="outline" onClick={() => act(r.id, false)}>Reject</Button>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {SUPPLY_STAGES.map((s, i) => (
                    <div key={s} title={s} className={`h-1.5 flex-1 rounded ${r.approval_status === "Rejected" && i + 1 === r.stage ? "bg-destructive" : i + 1 < r.stage || r.stage >= 8 ? "bg-success" : i + 1 === r.stage ? "bg-gold" : "bg-muted"}`} />
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{r.approval_status === "Rejected" ? "Rejected" : SUPPLY_STAGES[Math.min(r.stage, 8) - 1]}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
