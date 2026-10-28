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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { liberiaDateTime } from '@/lib/time';

const issOptions = queryOptions({
  queryKey: ["iss"],
  queryFn: async () => {
    const [v, g, r, o] = await Promise.all([
      supabase.from("iss_visitors").select("*").order("time_in", { ascending: false }).limit(200),
      supabase.from("iss_gate_logs").select("*").order("logged_at", { ascending: false }).limit(200),
      supabase.from("iss_duty_roster").select("*").order("shift_date", { ascending: false }).limit(200),
      supabase.from("iss_occurrences").select("*").order("occurred_at", { ascending: false }).limit(200),
    ]);
    for (const x of [v, g, r, o]) if (x.error) throw x.error;
    return { visitors: v.data ?? [], gate: g.data ?? [], roster: r.data ?? [], ob: o.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/security")({
  head: () => phaseHead("Internal Security Service", "LNPATS ISS visitor passes, vehicle gate logs, guard duty rosters and the Security Occurrence Book."),
  loader: ({ context }) => context.queryClient.ensureQueryData(issOptions),
  component: SecurityPage,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";
const fmt = (d: string | null) => liberiaDateTime(d);

function SecurityPage() {
  const { hasAny } = useAuth();
  const allowed = hasAny(["iss_officer", "commandant", "dc_admin"]);
  const canWrite = hasAny(["iss_officer"]);
  if (!allowed) return <div><PageHeader title="Internal Security Service" /><p className="text-sm text-muted-foreground">ISS records are restricted to ISS Officers and command staff.</p></div>;
  return <SecurityInner canWrite={canWrite} />;
}

function SecurityInner({ canWrite }: { canWrite: boolean }) {
  const { data } = useSuspenseQuery(issOptions);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["iss"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) return toast.error(error.message), false;
    toast.success(ok); refresh(); return true;
  };
  const onSite = data.visitors.filter((v) => !v.time_out).length;
  const openOb = data.ob.filter((o) => o.status !== "closed").length;
  const today = liberiaDate();

  return (
    <div className="space-y-5">
      <PageHeader title="Internal Security Service (ISS)" subtitle="Visitors · gate control · duty roster · occurrence book" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Visitors on site", onSite], ["Gate movements today", data.gate.filter((g) => g.logged_at.startsWith(today)).length], ["Guards on duty today", data.roster.filter((r) => r.shift_date === today).length], ["Open occurrences", openOb]].map(([l, n]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-bold">{n}</div></CardContent></Card>
        ))}
      </div>
      <Tabs defaultValue="visitors">
        <div className="overflow-x-auto"><TabsList className="w-max">
          <TabsTrigger value="visitors">Visitors</TabsTrigger><TabsTrigger value="gate">Vehicle gate</TabsTrigger>
          <TabsTrigger value="roster">Duty roster</TabsTrigger><TabsTrigger value="ob">Occurrence Book</TabsTrigger>
        </TabsList></div>

        <TabsContent value="visitors" className="space-y-3">
          {canWrite && <VisitorForm onSave={(f) => run(supabase.from("iss_visitors").insert(f), "Visitor signed in")} />}
          {data.visitors.map((v) => (
            <Card key={v.id}><CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{v.visitor_name}</span>{v.badge_number && <Badge variant="outline">Badge {v.badge_number}</Badge>}
              <span className="text-muted-foreground">{v.purpose}{v.host ? ` · to see ${v.host}` : ""} · in {fmt(v.time_in)} · out {fmt(v.time_out)}</span>
              {canWrite && !v.time_out && <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(supabase.from("iss_visitors").update({ time_out: new Date().toISOString() }).eq("id", v.id), "Visitor signed out")}>Sign out</Button>}
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="gate" className="space-y-3">
          {canWrite && <SimpleForm fields={[["plate_number", "Plate number", true], ["driver_name", "Driver"], ["purpose", "Purpose"], ["gate", "Gate"]]} selects={{ direction: ["In", "Out"] }} initial={{ gate: "Main Gate", direction: "In" }} label="Log vehicle" onSave={(f) => run(supabase.from("iss_gate_logs").insert(f as never), "Vehicle logged")} />}
          {data.gate.map((g) => (
            <Card key={g.id}><CardContent className="p-3 text-sm flex flex-wrap gap-2"><Badge variant={g.direction === "In" ? "default" : "secondary"}>{g.direction}</Badge><span className="font-medium">{g.plate_number}</span><span className="text-muted-foreground">{g.driver_name} · {g.purpose} · {g.gate} · {fmt(g.logged_at)}</span></CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="roster" className="space-y-3">
          {canWrite && <SimpleForm fields={[["post", "Guard post", true], ["officer_name", "Officer name", true], ["shift_date", "Date", true, "date"], ["notes", "Notes"]]} selects={{ shift: ["Morning", "Afternoon", "Night"] }} initial={{ shift: "Morning", shift_date: today }} label="Add to roster" onSave={(f) => run(supabase.from("iss_duty_roster").insert(f as never), "Roster updated")} />}
          {data.roster.map((r) => (
            <Card key={r.id}><CardContent className="p-3 text-sm flex flex-wrap gap-2"><span className="font-medium">{r.shift_date}</span><Badge variant="outline">{r.shift}</Badge><span>{r.post}</span><span className="text-muted-foreground">{r.officer_name}{r.notes ? ` · ${r.notes}` : ""}</span></CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="ob" className="space-y-3">
          {canWrite && <SimpleForm fields={[["location", "Location", true], ["description", "What happened", true, "area"], ["action_taken", "Action taken", false, "area"]]} selects={{ category: ["General", "Theft", "Trespass", "Assault", "Fire", "Property damage", "Lost & found", "Suspicious activity"] }} initial={{ category: "General" }} label="Record occurrence" onSave={(f) => run(supabase.from("iss_occurrences").insert(f as never), "Occurrence recorded")} />}
          {data.ob.map((o) => (
            <Card key={o.id}><CardContent className="p-3 text-sm space-y-1">
              <div className="flex flex-wrap gap-2 items-center"><span className="font-mono text-xs">{o.ob_number}</span><Badge variant="outline">{o.category}</Badge><Badge variant={o.status === "closed" ? "secondary" : "destructive"}>{o.status.replace("_", " ")}</Badge><span className="text-muted-foreground">{o.location} · {fmt(o.occurred_at)}</span></div>
              <p>{o.description}</p>{o.action_taken && <p className="text-muted-foreground">Action: {o.action_taken}</p>}
              {canWrite && o.status !== "closed" && <div className="flex gap-2">
                {o.status === "open" && <Button size="sm" variant="outline" onClick={() => run(supabase.from("iss_occurrences").update({ status: "under_investigation", updated_at: new Date().toISOString() }).eq("id", o.id), "Under investigation")}>Investigate</Button>}
                <Button size="sm" variant="outline" onClick={() => run(supabase.from("iss_occurrences").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", o.id), "Occurrence closed")}>Close</Button>
              </div>}
            </CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitorForm({ onSave }: { onSave: (f: { visitor_name: string; purpose: string; id_number?: string; phone?: string; host?: string; badge_number?: string; organization?: string }) => Promise<boolean> }) {
  return <SimpleForm fields={[["visitor_name", "Visitor name", true], ["purpose", "Purpose of visit", true], ["host", "Person to see"], ["organization", "Organization"], ["id_number", "ID number"], ["phone", "Phone"], ["badge_number", "Badge number"]]} label="Sign visitor in" onSave={(f) => onSave(f as never)} />;
}

function SimpleForm({ fields, selects = {}, initial = {}, label, onSave }: { fields: [string, string, boolean?, string?][]; selects?: Record<string, string[]>; initial?: Record<string, string>; label: string; onSave: (f: Record<string, string>) => Promise<boolean> }) {
  const [f, setF] = useState<Record<string, string>>(initial);
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">{label}</CardTitle></CardHeader><CardContent>
      <form className="grid sm:grid-cols-2 gap-3" onSubmit={async (e) => { e.preventDefault(); const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")); if (await onSave(clean)) setF(initial); }}>
        {Object.entries(selects).map(([k, opts]) => <select key={k} className={sel} value={f[k] ?? opts[0]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{opts.map((o) => <option key={o}>{o}</option>)}</select>)}
        {fields.map(([k, ph, req, type]) => type === "area"
          ? <Textarea key={k} className="sm:col-span-2" required={req} placeholder={ph} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          : <Input key={k} type={type ?? "text"} required={req} placeholder={ph} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
        <Button type="submit" className="sm:w-fit">Save</Button>
      </form>
    </CardContent></Card>
  );
}
