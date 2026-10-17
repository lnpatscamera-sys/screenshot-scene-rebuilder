import { formValues } from "@/lib/export";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { LEAVE_ENTITLEMENT, LEAVE_STAGES, LEAVE_STAGE_ROLES, leaveDays } from "@/lib/workflow";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave Management — LNPATS ERP" }] }),
  component: Leave,
});

function Leave() {
  const { session, hasAny } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["leave"],
    queryFn: async () => {
      const [l, o] = await Promise.all([
        supabase.from("leave_requests").select("*, officers(full_name, rank, service_number)").order("created_at", { ascending: false }),
        supabase.from("officers").select("id, full_name, rank").order("full_name"),
      ]);
      return { leave: l.data ?? [], officers: o.data ?? [] };
    },
  });
  const leave = data?.leave ?? [];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formValues(e.currentTarget);
    if (f.end_date < f.start_date) { toast.error("End date must be after start date"); return; }
    const { error } = await supabase.from("leave_requests").insert({
      officer_id: f.officer_id, leave_type: f.leave_type, start_date: f.start_date, end_date: f.end_date, reason: f.reason, requested_by: session!.user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Leave request submitted to Section Head");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  const act = async (id: string, approve: boolean) => {
    const note = approve ? null : prompt("Reason for rejection?") ?? null;
    const { error } = await supabase.rpc("act_on_leave", { _id: id, _approve: approve, _note: note ?? undefined });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved and forwarded" : "Rejected");
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  // balances: approved days used this year per officer per type
  const year = new Date().getFullYear();
  const balances = (data?.officers ?? []).map((o) => {
    const used: Record<string, number> = {};
    leave.filter((l) => l.officer_id === o.id && l.status === "Approved" && l.start_date.startsWith(String(year))).forEach((l) => {
      used[l.leave_type] = (used[l.leave_type] ?? 0) + leaveDays(l.start_date, l.end_date);
    });
    return { officer: o, used };
  });

  const month = new Date();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthStr = month.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Officer → Section Head → Assistant Commissioner → Deputy Commissioner → Commandant"
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
                      {data?.officers.map((o) => <option key={o.id} value={o.id}>{o.rank} {o.full_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label>Leave type</Label>
                    <select name="leave_type" className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                      {Object.keys(LEAVE_ENTITLEMENT).map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Start</Label><Input type="date" name="start_date" required /></div>
                    <div className="space-y-1"><Label>End</Label><Input type="date" name="end_date" required /></div>
                  </div>
                  <div className="space-y-1"><Label>Reason</Label><Textarea name="reason" rows={3} /></div>
                  <Button className="w-full">Submit</Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <Tabs defaultValue="requests">
        <TabsList><TabsTrigger value="requests">Requests</TabsTrigger><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="balance">Balances</TabsTrigger></TabsList>
        <TabsContent value="requests">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Officer</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Current stage</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {leave.map((l) => {
                  const mine = l.status === "Pending" && hasAny(LEAVE_STAGE_ROLES[l.stage] ?? []);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.officers?.rank} {l.officers?.full_name}</TableCell>
                      <TableCell>{l.leave_type}</TableCell>
                      <TableCell className="text-xs">{l.start_date} → {l.end_date} ({leaveDays(l.start_date, l.end_date)}d)</TableCell>
                      <TableCell>
                        <div className="flex gap-1">{[1, 2, 3, 4].map((s) => <span key={s} className={`h-1.5 w-6 rounded ${l.status === "Rejected" && s === l.stage ? "bg-destructive" : s < l.stage ? "bg-success" : s === l.stage && l.status === "Pending" ? "bg-gold" : "bg-muted"}`} />)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{l.status === "Pending" ? LEAVE_STAGES[l.stage - 1] : l.status}</div>
                      </TableCell>
                      <TableCell><StatusBadge value={l.status} /></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {mine && (<><Button size="sm" onClick={() => act(l.id, true)}>Approve</Button> <Button size="sm" variant="outline" onClick={() => act(l.id, false)}>Reject</Button></>)}
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
            <CardHeader><CardTitle className="text-base">Approved & pending leave — {monthStr}</CardTitle></CardHeader>
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
                    {Object.entries(LEAVE_ENTITLEMENT).map(([t, n]) => <TableCell key={t}>{n - (b.used[t] ?? 0)} left</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
