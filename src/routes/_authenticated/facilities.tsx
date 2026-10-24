import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { phaseHead } from "@/lib/phase2";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const workOrdersOptions = queryOptions({
  queryKey: ["facility_work_orders"],
  queryFn: async () => {
    const { data, error } = await supabase.from("facility_work_orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/facilities")({
  head: () => phaseHead("Facility Management", "Report building and facility faults, assign technicians and confirm completed maintenance work at LNPATS."),
  loader: ({ context }) => context.queryClient.ensureQueryData(workOrdersOptions),
  component: FacilitiesPage,
});

const CATEGORIES = ["General", "Electrical", "Plumbing", "Carpentry", "Generator", "Air Conditioning", "Cleaning", "Roofing"];
const STATUS_LABEL: Record<string, string> = { reported: "Reported", assigned: "Assigned", in_progress: "In progress", completed: "Completed — awaiting confirmation", confirmed: "Confirmed", cancelled: "Cancelled" };

function FacilitiesPage() {
  const { data } = useSuspenseQuery(workOrdersOptions);
  const { session, hasAny } = useAuth();
  const qc = useQueryClient();
  const mgr = hasAny(["facility_manager"]);
  const [form, setForm] = useState({ title: "", location: "", category: "General", priority: "Normal", description: "" });
  const [filter, setFilter] = useState("open");
  const refresh = () => qc.invalidateQueries({ queryKey: ["facility_work_orders"] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("facility_work_orders").insert({ ...form, reporter_name: session?.user.email ?? null });
    if (error) return toast.error(error.message);
    toast.success("Work order reported");
    setForm({ title: "", location: "", category: "General", priority: "Normal", description: "" });
    refresh();
  };
  const act = async (id: string, action: string, payload: Record<string, string> = {}) => {
    const { error } = await supabase.rpc("facility_action", { _id: id, _action: action, _payload: payload });
    if (error) return toast.error(error.message);
    toast.success("Work order updated");
    refresh();
  };

  const rows = data.filter((w) => filter === "all" || (filter === "open" ? !["confirmed", "cancelled"].includes(w.status) : w.status === filter));
  const count = (s: string[]) => data.filter((w) => s.includes(w.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Facility Management" subtitle="Report faults · Facility Manager assigns a technician · requester confirms the work" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Awaiting assignment", ["reported"]], ["In progress", ["assigned", "in_progress"]], ["Awaiting confirmation", ["completed"]], ["Confirmed", ["confirmed"]]].map(([l, s]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l as string}</div><div className="text-2xl font-bold">{count(s as string[])}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Report a facility problem</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <Input required placeholder="Problem (e.g. Broken window)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input required placeholder="Location (building / room)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((c) => <option key={c}>{c}</option>)}</select>
            <Textarea className="sm:col-span-2" placeholder="Details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" className="sm:w-fit">Submit work order</Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex gap-2 flex-wrap">
        {[["open", "Open"], ["completed", "Awaiting confirmation"], ["confirmed", "Confirmed"], ["all", "All"]].map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>{l}</Button>
        ))}
      </div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No work orders.</p>}
        {rows.map((w) => <WorkOrderCard key={w.id} w={w} mgr={mgr} mine={w.reported_by === session?.user.id} act={act} />)}
      </div>
    </div>
  );
}

type WO = Awaited<ReturnType<typeof workOrdersOptions.queryFn & {}>>[number];
function WorkOrderCard({ w, mgr, mine, act }: { w: WO; mgr: boolean; mine: boolean; act: (id: string, a: string, p?: Record<string, string>) => void }) {
  const [tech, setTech] = useState(w.technician ?? "");
  const [notes, setNotes] = useState("");
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{w.reference}</span>
          <span className="font-medium">{w.title}</span>
          <Badge variant="outline">{w.category}</Badge>
          <Badge variant={w.priority === "Urgent" || w.priority === "High" ? "destructive" : "secondary"}>{w.priority}</Badge>
          <Badge>{STATUS_LABEL[w.status]}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{w.location} · reported {new Date(w.created_at).toLocaleString()}{w.technician ? ` · technician: ${w.technician}` : ""}</div>
        {w.description && <p className="text-sm">{w.description}</p>}
        {w.completion_notes && <p className="text-sm"><span className="font-medium">Work notes:</span> {w.completion_notes}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {mgr && ["reported", "assigned"].includes(w.status) && (
            <>
              <Input className="h-8 w-48" placeholder="Technician name" value={tech} onChange={(e) => setTech(e.target.value)} />
              <Button size="sm" onClick={() => act(w.id, "assign", { technician: tech })}>Assign</Button>
            </>
          )}
          {mgr && w.status === "assigned" && <Button size="sm" variant="outline" onClick={() => act(w.id, "start")}>Mark in progress</Button>}
          {mgr && ["assigned", "in_progress"].includes(w.status) && (
            <>
              <Input className="h-8 w-56" placeholder="Work done" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => act(w.id, "complete", { notes })}>Mark completed</Button>
            </>
          )}
          {mine && w.status === "completed" && (
            <>
              <Button size="sm" onClick={() => act(w.id, "confirm")}>Confirm fixed</Button>
              <Button size="sm" variant="outline" onClick={() => act(w.id, "reopen", { notes: "Requester reports problem not fixed" })}>Not fixed — reopen</Button>
            </>
          )}
          {(mgr || mine) && !["completed", "confirmed", "cancelled"].includes(w.status) && <Button size="sm" variant="ghost" onClick={() => act(w.id, "cancel")}>Cancel</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
