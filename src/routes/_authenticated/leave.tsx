import { formValues } from "@/lib/export";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { LEAVE_ENTITLEMENT, LEAVE_STAGES, LEAVE_STAGE_ROLES, LEAVE_TYPES, leaveDays } from "@/lib/workflow";
import { exportCsv } from "@/lib/export";
import { AttachedFiles, Field, History, MetricBand, ReportActions, SelectField } from "@/components/Phase2Shared";
import { fileRecords, phase2Options, uploadPhaseFile } from "@/lib/phase2-data";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave Management — LNPATS ERP" }, { name: "description", content: "Review LNPATS leave applications, approval stages, and leave balances." }, { property: "og:title", content: "Leave Management — LNPATS ERP" }, { property: "og:description", content: "Review LNPATS leave applications, approval stages, and leave balances." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(phase2Options),
  component: Leave,
});

function Leave() {
  const { session, hasAny } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const { data } = useSuspenseQuery(phase2Options);
  const allLeave = data.leave;
  const leave = allLeave.filter(l => `${l.leave_number ?? ""} ${l.officers?.full_name ?? ""} ${l.leave_type} ${l.status}`.toLowerCase().includes(search.toLowerCase()));
  const detail = allLeave.find(l => l.id === selected);
  const applicants = data.officers.filter(o => o.user_id === session?.user.id || hasAny(["hr_officer", "commandant", "ict_admin"]));
  const reportRows = leave.map(l => ({ Number: l.leave_number, Officer: l.officers?.full_name, Type: l.leave_type, Start: l.start_date, End: l.end_date, Days: leaveDays(l.start_date,l.end_date), Status: l.status, Stage: LEAVE_STAGES[l.stage-1] }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session || busy) return;
    const f = formValues(e.currentTarget);
    if (f.end_date < f.start_date) { toast.error("End date must be after start date"); return; }
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement)?.files?.[0];
    setBusy(true);
    try {
      const attachments = file ? [await uploadPhaseFile(file, session.user.id)] : [];
      const { error } = await supabase.from("leave_requests").insert({ officer_id: f.officer_id, leave_type: f.leave_type, start_date: f.start_date, end_date: f.end_date, reason: f.reason, requested_by: session.user.id, delegate_officer_id: f.delegate_officer_id || null, attachments });
      if (error) throw error;
      toast.success("Leave request submitted to Section Head"); setOpen(false);
      await qc.invalidateQueries({ queryKey: ["phase2"] });
    } catch(e) { toast.error(e instanceof Error ? e.message : "Unable to submit leave"); } finally { setBusy(false); }
  };

  const act = async (id: string, approve: boolean) => {
    const note = approve ? null : prompt("Reason for rejection?") ?? null;
    if (!approve && !note) return;
    setBusy(true);
    const { error } = await supabase.rpc("act_on_leave", { _id: id, _approve: approve, _note: note ?? "" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved and forwarded" : "Rejected");
    qc.invalidateQueries({ queryKey: ["phase2"] });
  };

  // balances: approved days used this year per officer per type
  const year = new Date().getFullYear();
  const balances = (data?.officers ?? []).map((o) => {
    const used: Record<string, number> = {};
    leave.filter((l) => l.officer_id === o.id && l.status === "Approved" && l.start_date.startsWith(String(year))).forEach((l) => {
      used[l.leave_type] = (used[l.leave_type] ?? 0) + leaveDays(l.start_date, l.end_date);
    });
    const saved = data.balances.filter(b => b.officer_id === o.id && b.year === year).sort((a,b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
    return { officer: o, used, saved };
  });

  const month = new Date();
  month.setMonth(month.getMonth() + monthOffset);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthStr = month.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Officer → Section Head → Assistant Commissioner → Deputy Commissioner → Commandant → Human Resource Section"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv("leave-report.csv", leave.map((l) => ({ officer: l.officers?.full_name, type: l.leave_type, start: l.start_date, end: l.end_date, days: leaveDays(l.start_date, l.end_date), status: l.status, stage: LEAVE_STAGES[l.stage - 1] })))}>Export report</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button>Submit leave</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Leave application</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="space-y-1"><Label>Officer</Label>
                    <select name="officer_id" required className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                      {applicants.map((o) => <option key={o.id} value={o.id}>{o.rank} {o.full_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label>Leave type</Label>
                    <select name="leave_type" className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                      {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Start</Label><Input type="date" name="start_date" required /></div>
                    <div className="space-y-1"><Label>End</Label><Input type="date" name="end_date" required /></div>
                  </div>
                  <div className="space-y-1"><Label>Reason</Label><Textarea name="reason" rows={3} /></div>
                  <SelectField label="Delegated officer (optional)" name="delegate_officer_id" options={data.officers.map(o => ({value:o.id,label:`${o.rank} ${o.full_name}`}))} />
                  <Field label="Supporting document / medical certificate" name="file" type="file" />
                  <Button disabled={busy || applicants.length === 0} className="w-full">{busy ? "Submitting…" : "Submit"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <MetricBand items={[{label:"Pending",value:allLeave.filter(l=>l.status==='Pending').length},{label:"Approved",value:allLeave.filter(l=>l.status==='Approved').length},{label:"Rejected",value:allLeave.filter(l=>l.status==='Rejected').length},{label:"Officers on leave",value:allLeave.filter(l=>l.status==='Approved' && l.start_date<=new Date().toISOString().slice(0,10) && l.end_date>=new Date().toISOString().slice(0,10)).length}]} />
      <div className="flex justify-between gap-3 flex-wrap mb-4"><Input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search leave" placeholder="Leave number, officer or status" className="max-w-sm" /><ReportActions title="Leave report" rows={reportRows} /></div>
      <Tabs defaultValue="requests">
        <TabsList><TabsTrigger value="requests">Requests</TabsTrigger><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="balance">Balances</TabsTrigger><TabsTrigger value="analytics">Trends</TabsTrigger></TabsList>
        <TabsContent value="requests">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Officer</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Current stage</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {leave.map((l) => {
                  const mine = l.status === "Pending" && hasAny([...(LEAVE_STAGE_ROLES[l.stage] ?? []),"commandant","ict_admin"]);
                  return (
                    <TableRow key={l.id}>
                      <TableCell><Button variant="link" className="h-auto p-0" onClick={()=>{setSelected(l.id);supabase.rpc("record_activity",{_module:"leave",_id:l.id,_action:"VIEW"});}}>{l.leave_number ?? "Leave request"}</Button><div>{l.officers?.rank} {l.officers?.full_name}</div></TableCell>
                      <TableCell>{l.leave_type}</TableCell>
                      <TableCell className="text-xs">{l.start_date} → {l.end_date} ({leaveDays(l.start_date, l.end_date)}d)</TableCell>
                      <TableCell>
                        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((s) => <span key={s} className={`h-1.5 w-6 rounded ${l.status === "Rejected" && s === l.stage ? "bg-destructive" : s < l.stage ? "bg-success" : s === l.stage && l.status === "Pending" ? "bg-gold" : "bg-muted"}`} />)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{l.status === "Pending" ? LEAVE_STAGES[l.stage - 1] : l.status}</div>
                      </TableCell>
                      <TableCell><StatusBadge value={l.status} /></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {mine && (<><Button disabled={busy} size="sm" onClick={() => act(l.id, true)}>{l.stage===5 ? "Process leave" : "Approve"}</Button> <Button disabled={busy} size="sm" variant="outline" onClick={() => act(l.id, false)}>Reject</Button></>)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <Card>
            <CardHeader><div className="flex justify-between gap-2"><CardTitle className="text-base">Approved & pending leave — {monthStr}</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setMonthOffset(monthOffset-1)}>Previous</Button><Button size="sm" variant="outline" onClick={()=>setMonthOffset(monthOffset+1)}>Next</Button></div></div></CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[800px] text-xs">
                <div className="grid" style={{ gridTemplateColumns: `180px repeat(${days}, 1fr)` }}>
                  <div />
                  {Array.from({ length: days }, (_, d) => <div key={d} className="text-center text-muted-foreground">{d + 1}</div>)}
                  {leave.filter((l) => l.status !== "Rejected").map((l) => {
                    const s = new Date(l.start_date), e = new Date(l.end_date);
                    return [
                      <div key={l.id + "n"} className="truncate py-1">{l.officers?.full_name}</div>,
                      ...Array.from({ length: days }, (_, d) => {
                        const day = new Date(month.getFullYear(), month.getMonth(), d + 1);
                        const on = day >= new Date(s.toDateString()) && day <= new Date(e.toDateString());
                        return <div key={l.id + d} className={`h-5 my-0.5 ${on ? (l.status === "Approved" ? "bg-success" : "bg-gold") : ""}`} />;
                      }),
                    ];
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="balance">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Officer</TableHead>{Object.entries(LEAVE_ENTITLEMENT).map(([t, n]) => <TableHead key={t}>{t} ({n}d)</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.officer.id}>
                    <TableCell>{b.officer.rank} {b.officer.full_name}</TableCell>
                    {Object.entries(LEAVE_ENTITLEMENT).map(([t, n]) => <TableCell key={t}>{t==='Annual' ? b.saved?.annual_leave_balance ?? n-(b.used[t]??0) : t==='Sick' ? n-(b.saved?.sick_leave_used ?? b.used[t]??0) : t==='Emergency' ? n-(b.saved?.emergency_leave_used ?? b.used[t]??0) : n-(b.used[t]??0)} left</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="analytics"><h2 className="font-semibold my-4">Monthly leave applications — {year}</h2><div className="grid grid-cols-3 sm:grid-cols-6 gap-4">{Array.from({length:12},(_,m)=>{const count=allLeave.filter(l=>l.start_date.startsWith(`${year}-${String(m+1).padStart(2,'0')}`)).length;return <div key={m} className="border-b py-3"><div className="text-xs text-muted-foreground">{new Date(year,m,1).toLocaleString('default',{month:'short'})}</div><div className="text-2xl font-bold">{count}</div></div>;})}</div><ReportActions title="Leave balance summary" rows={balances.map(b=>({Officer:b.officer.full_name,Year:year,Allocated:b.saved?.annual_leave_allocated??30,Used:b.saved?.annual_leave_used??b.used['Annual']??0,Balance:b.saved?.annual_leave_balance??30-(b.used['Annual']??0)}))} /></TabsContent>
      </Tabs>
      <Dialog open={!!detail} onOpenChange={o=>!o&&setSelected(null)}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{detail?.leave_number ?? "Leave history"}</DialogTitle></DialogHeader>{detail&&<div className="space-y-4"><p>{detail.officers?.rank} {detail.officers?.full_name} · {detail.leave_type}</p><p className="text-sm">{detail.start_date} → {detail.end_date} · {leaveDays(detail.start_date,detail.end_date)} days</p><StatusBadge value={detail.status} /><p className="text-sm">{detail.reason}</p>{detail.delegate_officer_id&&<p className="text-sm">Delegated to: {data.officers.find(o=>o.id===detail.delegate_officer_id)?.full_name}</p>}<AttachedFiles files={fileRecords(detail.attachments)} module="leave" id={detail.id}/><h3 className="font-semibold">Approval history</h3><History value={detail.history}/><ReportActions title="Leave history report" rows={reportRows.filter(r=>r.Number===detail.leave_number)}/>{detail.status==='Approved'&&<Button onClick={async()=>{await supabase.rpc('record_activity',{_module:'leave',_id:detail.id,_action:'DOWNLOAD'});await exportPdf('Leave approval letter',[{Officer:detail.officers?.full_name,Service:detail.officers?.service_number,Reference:detail.leave_number,Decision:'Approved and processed by Human Resource Section',Type:detail.leave_type,Start:detail.start_date,End:detail.end_date,Days:leaveDays(detail.start_date,detail.end_date)}]);}}>Download approval letter</Button>}</div>}</DialogContent></Dialog>
    </div>
  );
}
