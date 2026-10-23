import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Plus, Pencil, Paperclip, Printer, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { AttachedFiles, Field, ReportActions, SelectField } from "@/components/Phase2Shared";
import { formValues } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { uploadPhaseFile, type FileRecord } from "@/lib/phase2-data";
import {
  ATTACHMENT_TYPES, BUDGET_APPROVERS, BUDGET_CATEGORIES, CASH_STAGES, CASH_STAGE_ROLES, EXPENSE_STAGE_ROLES, FINANCE_READERS, FINANCE_STAFF,
  FUNDING_SOURCES, HIGH_VALUE_THRESHOLD, PAYMENT_METHODS, PROCUREMENT_STAGES, PROCUREMENT_STAGE_ROLES, REVENUE_SOURCES,
  budgetAlerts, financeAction, financeOptions, money, monthly, refreshFinance, utilization,
  type Budget, type CashRequest, type Expense, type ProcurementRequest, type Revenue,
} from "@/lib/finance";

const TITLE = "Finance Management — LNPATS ERP";
const DESC = "LNPATS budgets, expenses, revenue, cash advances, procurement funding, approvals and financial reports.";
export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeOptions),
  component: Finance,
});

type Data = Awaited<ReturnType<NonNullable<typeof financeOptions.queryFn>>>;
type Module = "budgets" | "expenses" | "cash_requests" | "procurement_funding";
const TABS = ["Dashboard", "Budgets", "Monitoring", "Expenses", "Revenue", "Cash Requests", "Procurement", "Reports", "Audit"] as const;
const num = (v: unknown) => Number(v ?? 0);
const opt = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

function useAct() {
  const qc = useQueryClient();
  return async (module: Module, id: string, action: string, needNote = false, amount?: number) => {
    let note: string | undefined;
    if (needNote || action === "reject") {
      const n = window.prompt(action === "reject" ? "Reason for rejection" : "Comment (optional)") ?? null;
      if (n === null) return;
      if (action === "reject" && !n.trim()) return toast.error("A reason is required");
      note = n || undefined;
    }
    try { await financeAction(module, id, action, note, amount); toast.success("Updated"); await refreshFinance(qc); }
    catch (e) { toast.error((e as Error).message); }
  };
}

function Finance() {
  const { data } = useSuspenseQuery(financeOptions);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  return (
    <div>
      <PageHeader title="Finance Management" subtitle="Budgets, spending, revenue and approvals for the Academy" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-5 no-print">
        <TabsList className="flex-wrap h-auto">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
      </Tabs>
      {tab === "Dashboard" && <DashboardTab d={data} />}
      {tab === "Budgets" && <BudgetsTab d={data} />}
      {tab === "Monitoring" && <MonitoringTab d={data} />}
      {tab === "Expenses" && <ExpensesTab d={data} />}
      {tab === "Revenue" && <RevenueTab d={data} />}
      {tab === "Cash Requests" && <CashTab d={data} />}
      {tab === "Procurement" && <ProcurementTab d={data} />}
      {tab === "Reports" && <ReportsTab d={data} />}
      {tab === "Audit" && <AuditTab />}
    </div>
  );
}

function sectionName(d: Data, id: string | null) { return d.sections.find((s) => s.id === id)?.name ?? "—"; }
function vendorName(d: Data, id: string | null) { return d.vendors.find((v) => v.id === id)?.company_name ?? "—"; }

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold mt-1">{value}</div></div>;
}

function DashboardTab({ d }: { d: Data }) {
  const year = new Date().getFullYear();
  const active = d.budgets.filter((b) => b.status === "Approved" && b.fiscal_year === year);
  const total = active.reduce((s, b) => s + num(b.allocated_amount), 0);
  const used = active.reduce((s, b) => s + num(b.used_amount), 0);
  const approvedExp = d.expenses.filter((e) => e.status === "Approved");
  const revenue = d.revenues.reduce((s, r) => s + num(r.amount), 0);
  const expenditure = approvedExp.reduce((s, e) => s + num(e.amount), 0);
  const pendingPay = d.cash.filter((c) => c.stage >= 1 && c.stage <= 3 && c.status !== "Rejected").length + d.expenses.filter((e) => e.status === "Pending").length;
  const approvedProc = d.procurement.filter((p) => p.status === "Approved");
  const obligations = d.cash.filter((c) => c.stage === 4 || c.stage === 5).reduce((s, c) => s + num(c.amount), 0) + approvedProc.filter((p) => !p.purchase_order_id).reduce((s, p) => s + num(p.estimated_cost), 0);
  const rev = monthly(d.revenues, (r) => r.received_date, (r) => num(r.amount), year);
  const exp = monthly(approvedExp, (e) => e.expense_date ?? e.created_at, (e) => num(e.amount), year);
  const trend = rev.map((m, i) => ({ month: m.month, revenue: m.total, expenditure: exp[i]!.total }));
  const byDept = Object.values(active.reduce<Record<string, { name: string; allocated: number; used: number }>>((m, b) => {
    const k = sectionName(d, b.department); m[k] ??= { name: k, allocated: 0, used: 0 }; m[k].allocated += num(b.allocated_amount); m[k].used += num(b.used_amount); return m;
  }, {}));
  const procByDept = Object.entries(approvedProc.reduce<Record<string, number>>((m, p) => { const k = sectionName(d, p.section_id); m[k] = (m[k] ?? 0) + num(p.estimated_cost); return m; }, {})).map(([name, value]) => ({ name, value }));
  const years = [...new Set([...d.budgets.map((b) => b.fiscal_year ?? year), year])].sort();
  const annual = years.map((y) => ({ year: String(y), budget: d.budgets.filter((b) => b.fiscal_year === y && b.status !== "Rejected").reduce((s, b) => s + num(b.allocated_amount), 0), revenue: d.revenues.filter((r) => new Date(r.received_date).getFullYear() === y).reduce((s, r) => s + num(r.amount), 0), expenditure: approvedExp.filter((e) => new Date(e.expense_date ?? e.created_at).getFullYear() === y).reduce((s, e) => s + num(e.amount), 0) }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 border-y py-5">
        <Stat label={`Annual budget ${year}`} value={money(total)} />
        <Stat label="Budget utilized" value={money(used)} />
        <Stat label="Remaining budget" value={money(total - used)} />
        <Stat label="Total revenue" value={money(revenue)} />
        <Stat label="Total expenditure" value={money(expenditure)} />
        <Stat label="Pending payment requests" value={pendingPay} />
        <Stat label="Approved procurement" value={approvedProc.length} />
        <Stat label="Outstanding obligations" value={money(obligations)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Chart title="Monthly revenue & expenditure"><LineChart data={trend}><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v) => money(Number(v))} /><Legend /><Line dataKey="revenue" stroke="var(--chart-1)" /><Line dataKey="expenditure" stroke="var(--chart-2)" /></LineChart></Chart>
        <Chart title="Budget utilization by department"><BarChart data={byDept}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} /><Tooltip formatter={(v) => money(Number(v))} /><Legend /><Bar dataKey="allocated" fill="var(--chart-3)" /><Bar dataKey="used" fill="var(--chart-2)" /></BarChart></Chart>
        <Chart title="Procurement spending"><BarChart data={procByDept}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="value" fill="var(--chart-4)" /></BarChart></Chart>
        <Chart title="Annual financial summary"><BarChart data={annual}><XAxis dataKey="year" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v) => money(Number(v))} /><Legend /><Bar dataKey="budget" fill="var(--chart-1)" /><Bar dataKey="revenue" fill="var(--chart-3)" /><Bar dataKey="expenditure" fill="var(--chart-2)" /></BarChart></Chart>
      </div>
    </div>
  );
}
function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer>{children}</ResponsiveContainer></CardContent></Card>;
}

function Timeline({ d, module, id }: { d: Data; module: string; id: string }) {
  const rows = d.approvals.filter((a) => a.module === module && a.record_id === id);
  if (!rows.length) return <p className="text-sm text-muted-foreground">No approval activity yet.</p>;
  return <div className="space-y-3 text-sm">{rows.map((a) => <div key={a.id} className="border-l-2 border-gold pl-3"><div className="font-medium capitalize">{a.action} · {a.level}</div><div className="text-xs text-muted-foreground">{a.actor_name} · {new Date(a.created_at).toLocaleString()}</div>{a.signature && <div className="text-xs italic">Signed: {a.signature}</div>}{a.note && <p className="mt-1">{a.note}</p>}</div>)}</div>;
}
function TimelineDialog({ d, module, id, title, onClose }: { d: Data; module: string; id: string | null; title: string; onClose: () => void }) {
  return <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{id && <Timeline d={d} module={module} id={id} />}</DialogContent></Dialog>;
}

function BudgetsTab({ d }: { d: Data }) {
  const { hasAny, roles } = useAuth();
  const qc = useQueryClient(); const act = useAct();
  const canCreate = hasAny(FINANCE_STAFF) || roles.includes("section_head");
  const [edit, setEdit] = useState<Budget | "new" | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = d.budgets.filter((b) => `${b.budget_number} ${b.category} ${b.description} ${sectionName(d, b.department)}`.toLowerCase().includes(q.toLowerCase()));
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const v = formValues(e.currentTarget);
    const rec = { fiscal_year: Number(v.fiscal_year), department: v.department || null, category: v.category, description: v.description || null, requested_amount: Number(v.requested_amount), funding_source: v.funding_source || null };
    const { error } = edit === "new" ? await supabase.from("budgets").insert(rec) : await supabase.from("budgets").update(rec).eq("id", (edit as Budget).id);
    if (error) return toast.error(error.message);
    toast.success("Budget saved"); setEdit(null); refreshFinance(qc);
  };
  const approve = (b: Budget) => {
    const v = window.prompt("Approved amount", String(b.requested_amount)); if (v === null) return;
    const amt = Number(v); if (!(amt >= 0)) return toast.error("Enter a valid amount");
    act("budgets", b.id, "approve", false, amt);
  };
  const cur = edit && edit !== "new" ? edit : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 justify-between"><Input placeholder="Search budgets…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2"><ReportActions title="Budget report" rows={rows.map((b) => ({ ID: b.budget_number, Year: b.fiscal_year, Department: sectionName(d, b.department), Category: b.category, Requested: b.requested_amount, Approved: b.allocated_amount, Source: b.funding_source, Status: b.status }))} />{canCreate && <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New budget</Button>}</div></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Budget ID</TableHead><TableHead>Year</TableHead><TableHead>Department</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Requested</TableHead><TableHead className="text-right">Approved</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No budgets yet.</TableCell></TableRow>}
          {rows.map((b) => <TableRow key={b.id}><TableCell className="font-mono text-xs">{b.budget_number}</TableCell><TableCell>{b.fiscal_year}</TableCell><TableCell>{sectionName(d, b.department)}</TableCell><TableCell>{b.category}</TableCell><TableCell className="text-right">{money(b.requested_amount)}</TableCell><TableCell className="text-right">{money(b.allocated_amount)}</TableCell><TableCell><StatusBadge value={b.status} /></TableCell>
            <TableCell className="flex flex-wrap gap-1 justify-end">
              {(b.status === "Draft" || b.status === "Rejected") && <><Button size="icon" variant="ghost" aria-label="Edit budget" onClick={() => setEdit(b)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => act("budgets", b.id, "submit")}>Submit</Button></>}
              {b.status === "Submitted" && hasAny(BUDGET_APPROVERS) && <><Button size="sm" onClick={() => approve(b)}>Approve</Button><Button size="sm" variant="outline" onClick={() => act("budgets", b.id, "reject")}>Reject</Button></>}
              {(b.status === "Approved" || b.status === "Rejected") && hasAny(FINANCE_STAFF) && <Button size="sm" variant="ghost" onClick={() => act("budgets", b.id, "archive")}>Archive</Button>}
              <Button size="sm" variant="ghost" onClick={() => setHist(b.id)}>History</Button>
            </TableCell></TableRow>)}</TableBody></Table></div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>{cur ? `Edit ${cur.budget_number}` : "New budget"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <Field label="Fiscal year" name="fiscal_year" type="number" required defaultValue={String(cur?.fiscal_year ?? new Date().getFullYear())} />
          <SelectField label="Department" name="department" required options={d.sections.map((s) => ({ value: s.id, label: s.name }))} defaultValue={cur?.department ?? ""} />
          <SelectField label="Budget category" name="category" required options={opt(BUDGET_CATEGORIES)} defaultValue={cur?.category ?? ""} />
          <SelectField label="Funding source" name="funding_source" options={opt(FUNDING_SOURCES)} defaultValue={cur?.funding_source ?? ""} />
          <Field label="Requested amount (USD)" name="requested_amount" type="number" required defaultValue={cur ? String(cur.requested_amount) : ""} />
          <div className="sm:col-span-2 space-y-1"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={cur?.description ?? ""} /></div>
          <Button type="submit" className="sm:col-span-2">Save draft</Button>
        </form></DialogContent></Dialog>
      <TimelineDialog d={d} module="budgets" id={hist} title="Budget approval history" onClose={() => setHist(null)} />
    </div>
  );
}

function MonitoringTab({ d }: { d: Data }) {
  const rows = d.budgets.filter((b) => b.status === "Approved");
  const report = rows.map((b) => ({ ID: b.budget_number, Department: sectionName(d, b.department), Category: b.category, Requested: num(b.requested_amount), Allocated: num(b.allocated_amount), Spent: num(b.used_amount), Remaining: num(b.remaining_amount), "Utilization %": utilization(num(b.allocated_amount), num(b.used_amount)), Variance: num(b.allocated_amount) - num(b.used_amount), Alerts: budgetAlerts(b).join(", ") }));
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2"><ReportActions title="Budget performance and variance" rows={report} /></div>
      {rows.length === 0 && <p className="text-muted-foreground text-sm">No approved budgets to monitor yet.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((b) => { const pct = utilization(num(b.allocated_amount), num(b.used_amount)); const alerts = budgetAlerts(b); return (
        <Card key={b.id}><CardContent className="p-4 space-y-2">
          <div className="flex justify-between gap-2"><div><div className="font-medium">{b.category} · {sectionName(d, b.department)}</div><div className="text-xs text-muted-foreground font-mono">{b.budget_number} · FY {b.fiscal_year}</div></div><span className="text-sm font-semibold">{pct}%</span></div>
          <Progress value={Math.min(pct, 100)} />
          <div className="grid grid-cols-3 text-xs"><div><div className="text-muted-foreground">Allocated</div>{money(b.allocated_amount)}</div><div><div className="text-muted-foreground">Spent</div>{money(b.used_amount)}</div><div><div className="text-muted-foreground">Remaining</div>{money(b.remaining_amount)}</div></div>
          {alerts.map((a) => <div key={a} className={`flex items-center gap-1 text-xs font-medium ${a === "Budget Exceeded" ? "text-destructive" : "text-accent-foreground"}`}><AlertTriangle className="h-3 w-3" />{a === "Expiring" ? "Budget period ends soon" : a === "Low Budget" ? "Low budget warning" : "Budget exceeded"}</div>)}
        </CardContent></Card>); })}</div>
    </div>
  );
}

function ExpensesTab({ d }: { d: Data }) {
  const { hasAny, session } = useAuth(); const qc = useQueryClient(); const act = useAct();
  const staff = hasAny(FINANCE_STAFF);
  const [edit, setEdit] = useState<Expense | "new" | null>(null);
  const [view, setView] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = edit && edit !== "new" ? edit : null;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!session) return; setBusy(true);
    try {
      const form = e.currentTarget; const v = formValues(form);
      const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
      const uploaded: FileRecord[] = [];
      for (const f of files) uploaded.push({ ...(await uploadPhaseFile(f, session.user.id)), name: `${v.doc_type}: ${f.name}` });
      const rec = { expense_date: v.expense_date, section_id: v.section_id || null, vendor_id: v.vendor_id || null, expense_type: v.expense_type, description: v.description || null, amount: Number(v.amount), payment_method: v.payment_method || null, budget_id: v.budget_id || null, attachments: [...((cur?.attachments as FileRecord[] | undefined) ?? []), ...uploaded] };
      const { error } = cur ? await supabase.from("expenses").update(rec).eq("id", cur.id) : await supabase.from("expenses").insert(rec);
      if (error) throw error;
      toast.success("Expense saved"); setEdit(null); refreshFinance(qc);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-between flex-wrap gap-2"><p className="text-sm text-muted-foreground">Expenses above {money(HIGH_VALUE_THRESHOLD)} also need Commandant approval.</p><div className="flex gap-2"><ReportActions title="Expenditure report" rows={d.expenses.map((x) => ({ Ref: x.expense_number, Date: x.expense_date, Department: sectionName(d, x.section_id), Vendor: vendorName(d, x.vendor_id), Category: x.expense_type, Amount: x.amount, Method: x.payment_method, Status: x.status }))} />{staff && <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Record expense</Button>}</div></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Department</TableHead><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{d.expenses.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No expenses recorded.</TableCell></TableRow>}
          {d.expenses.map((x) => <TableRow key={x.id}><TableCell className="font-mono text-xs">{x.expense_number}</TableCell><TableCell>{x.expense_date}</TableCell><TableCell>{sectionName(d, x.section_id)}</TableCell><TableCell>{vendorName(d, x.vendor_id)}</TableCell><TableCell>{x.expense_type}</TableCell><TableCell className="text-right">{money(x.amount)}</TableCell><TableCell><StatusBadge value={x.status === "Pending" && x.stage === 2 ? "Pending Commandant" : x.status} /></TableCell>
            <TableCell className="flex gap-1 justify-end flex-wrap">
              {x.status === "Pending" && x.stage === 1 && staff && <Button size="icon" variant="ghost" aria-label="Edit expense" onClick={() => setEdit(x)}><Pencil className="h-4 w-4" /></Button>}
              {x.status === "Pending" && hasAny(EXPENSE_STAGE_ROLES[x.stage] ?? []) && <><Button size="sm" onClick={() => act("expenses", x.id, "approve")}>Approve</Button><Button size="sm" variant="outline" onClick={() => act("expenses", x.id, "reject")}>Reject</Button></>}
              <Button size="sm" variant="ghost" onClick={() => setView(x)}><Paperclip className="h-4 w-4" />Details</Button>
            </TableCell></TableRow>)}</TableBody></Table></div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{cur ? `Edit ${cur.expense_number}` : "Record expense"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <Field label="Date" name="expense_date" type="date" required defaultValue={cur?.expense_date ?? new Date().toISOString().slice(0, 10)} />
          <SelectField label="Department" name="section_id" required options={d.sections.map((s) => ({ value: s.id, label: s.name }))} defaultValue={cur?.section_id ?? ""} />
          <SelectField label="Vendor" name="vendor_id" options={d.vendors.map((v) => ({ value: v.id, label: v.company_name ?? "Vendor" }))} defaultValue={cur?.vendor_id ?? ""} />
          <SelectField label="Expense category" name="expense_type" required options={opt(BUDGET_CATEGORIES)} defaultValue={cur?.expense_type ?? ""} />
          <Field label="Amount (USD)" name="amount" type="number" required defaultValue={cur ? String(cur.amount) : ""} />
          <SelectField label="Payment method" name="payment_method" required options={opt(PAYMENT_METHODS)} defaultValue={cur?.payment_method ?? ""} />
          <SelectField label="Charge to budget" name="budget_id" options={d.budgets.filter((b) => b.status === "Approved").map((b) => ({ value: b.id, label: `${b.budget_number} · ${b.category}` }))} defaultValue={cur?.budget_id ?? ""} />
          <SelectField label="Document type" name="doc_type" options={opt(ATTACHMENT_TYPES)} defaultValue="Invoice" />
          <div className="sm:col-span-2 space-y-1"><Label htmlFor="files">Supporting documents</Label><Input id="files" name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" /></div>
          <div className="sm:col-span-2 space-y-1"><Label htmlFor="edesc">Description</Label><Textarea id="edesc" name="description" defaultValue={cur?.description ?? ""} /></div>
          <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Saving…" : "Save expense"}</Button>
        </form></DialogContent></Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}><DialogContent><DialogHeader><DialogTitle>{view?.expense_number}</DialogTitle></DialogHeader>
        {view && <div className="space-y-4"><p className="text-sm">{view.description}</p><div><h3 className="font-medium text-sm mb-1">Supporting documents</h3><AttachedFiles files={(view.attachments as FileRecord[]) ?? []} module="expenses" id={view.id} /></div><div><h3 className="font-medium text-sm mb-1">Approval timeline</h3><Timeline d={d} module="expenses" id={view.id} /></div></div>}
      </DialogContent></Dialog>
    </div>
  );
}

function printReceipt(r: Revenue) {
  const w = window.open("", "_blank", "width=600,height=700"); if (!w) return;
  const doc = w.document;
  doc.title = `Receipt ${r.revenue_number}`;
  const body = doc.body; body.style.fontFamily = "serif"; body.style.padding = "32px";
  const lines: [string, string][] = [["Receipt No.", r.revenue_number ?? ""], ["Date received", r.received_date], ["Source", r.source], ["Amount", money(r.amount)], ["Received by", r.received_by_name ?? ""], ["Description", r.description ?? ""]];
  const h = doc.createElement("h2"); h.textContent = "Liberia National Police Academy and Training School — Official Revenue Receipt"; body.appendChild(h);
  for (const [k, v] of lines) { const p = doc.createElement("p"); const b = doc.createElement("strong"); b.textContent = `${k}: `; p.appendChild(b); p.appendChild(doc.createTextNode(v)); body.appendChild(p); }
  const s = doc.createElement("p"); s.style.marginTop = "48px"; s.textContent = "Finance Section signature: ______________________"; body.appendChild(s);
  w.print();
}

function RevenueTab({ d }: { d: Data }) {
  const { hasAny } = useAuth(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const v = formValues(e.currentTarget);
    const officer = d.officers.find((o) => o.id === v.received_by);
    const { error } = await supabase.from("revenues").insert({ source: v.source, received_date: v.received_date, amount: Number(v.amount), received_by: v.received_by || null, received_by_name: officer?.full_name ?? null, description: v.description || null });
    if (error) return toast.error(error.message);
    toast.success("Revenue recorded"); setOpen(false); refreshFinance(qc);
  };
  const bySource = REVENUE_SOURCES.map((s) => ({ Source: s, Total: d.revenues.filter((r) => r.source === s).reduce((t, r) => t + num(r.amount), 0) }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 border-y py-4">{bySource.map((s) => <Stat key={s.Source} label={s.Source} value={money(s.Total)} />)}</div>
      <div className="flex justify-end gap-2"><ReportActions title="Revenue report" rows={d.revenues.map((r) => ({ No: r.revenue_number, Source: r.source, Date: r.received_date, Amount: r.amount, "Received by": r.received_by_name, Description: r.description }))} />{hasAny(FINANCE_STAFF) && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Record revenue</Button>}</div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Revenue No.</TableHead><TableHead>Source</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Received by</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{d.revenues.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No revenue recorded.</TableCell></TableRow>}
          {d.revenues.map((r) => <TableRow key={r.id}><TableCell className="font-mono text-xs">{r.revenue_number}</TableCell><TableCell>{r.source}</TableCell><TableCell>{r.received_date}</TableCell><TableCell className="text-right">{money(r.amount)}</TableCell><TableCell>{r.received_by_name ?? "—"}</TableCell><TableCell><Button size="sm" variant="ghost" onClick={() => printReceipt(r)}><Printer className="h-4 w-4" />Receipt</Button></TableCell></TableRow>)}</TableBody></Table></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Record revenue</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Revenue source" name="source" required options={opt(REVENUE_SOURCES)} />
          <Field label="Date received" name="received_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          <Field label="Amount (USD)" name="amount" type="number" required />
          <SelectField label="Received by" name="received_by" options={d.officers.map((o) => ({ value: o.id, label: o.full_name }))} />
          <div className="sm:col-span-2 space-y-1"><Label htmlFor="rdesc">Description</Label><Textarea id="rdesc" name="description" /></div>
          <Button type="submit" className="sm:col-span-2">Save</Button>
        </form></DialogContent></Dialog>
    </div>
  );
}

function CashTab({ d }: { d: Data }) {
  const { hasAny, session } = useAuth(); const qc = useQueryClient(); const act = useAct();
  const [edit, setEdit] = useState<CashRequest | "new" | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const cur = edit && edit !== "new" ? edit : null;
  const me = d.officers.find((o) => o.user_id === session?.user.id);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const v = formValues(e.currentTarget);
    const rec = { officer_id: v.officer_id || null, section_id: v.section_id || null, purpose: v.purpose, amount: Number(v.amount), justification: v.justification || null, date_required: v.date_required || null };
    const { error } = cur ? await supabase.from("cash_requests").update(rec).eq("id", cur.id) : await supabase.from("cash_requests").insert(rec);
    if (error) return toast.error(error.message);
    toast.success("Saved as draft"); setEdit(null); refreshFinance(qc);
  };
  const remove = async (id: string) => { if (!window.confirm("Delete this draft?")) return; const { error } = await supabase.from("cash_requests").delete().eq("id", id); if (error) toast.error(error.message); else refreshFinance(qc); };
  return (
    <div className="space-y-3">
      <div className="flex justify-between flex-wrap gap-2"><p className="text-sm text-muted-foreground">Draft → Supervisor → Finance → Commandant → Approved → Funds released → Closed</p><div className="flex gap-2"><ReportActions title="Cash advance requests" rows={d.cash.map((c) => ({ No: c.request_number, Officer: d.officers.find((o) => o.id === c.officer_id)?.full_name, Department: sectionName(d, c.section_id), Purpose: c.purpose, Amount: c.amount, Required: c.date_required, Status: c.status }))} /><Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New request</Button></div></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Request No.</TableHead><TableHead>Officer</TableHead><TableHead>Department</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Stage</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{d.cash.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No cash requests.</TableCell></TableRow>}
          {d.cash.map((c) => { const mine = c.requested_by === session?.user.id; return <TableRow key={c.id}><TableCell className="font-mono text-xs">{c.request_number}</TableCell><TableCell>{d.officers.find((o) => o.id === c.officer_id)?.full_name ?? "—"}</TableCell><TableCell>{sectionName(d, c.section_id)}</TableCell><TableCell className="max-w-48 truncate">{c.purpose}</TableCell><TableCell className="text-right">{money(c.amount)}</TableCell><TableCell><StatusBadge value={c.status} /><div className="text-[11px] text-muted-foreground">{CASH_STAGES[c.stage]}</div></TableCell>
            <TableCell className="flex gap-1 justify-end flex-wrap">
              {c.stage === 0 && mine && <><Button size="icon" variant="ghost" aria-label="Edit request" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button><Button size="sm" onClick={() => act("cash_requests", c.id, "submit")}>Submit</Button><Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Delete</Button></>}
              {c.stage >= 1 && c.stage <= 3 && c.status !== "Rejected" && hasAny(CASH_STAGE_ROLES[c.stage] ?? []) && <><Button size="sm" onClick={() => act("cash_requests", c.id, "approve", true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => act("cash_requests", c.id, "reject")}>Reject</Button></>}
              {c.stage === 4 && hasAny(FINANCE_STAFF) && <Button size="sm" onClick={() => act("cash_requests", c.id, "release", true)}>Release funds</Button>}
              {c.stage === 5 && (hasAny(FINANCE_STAFF) || mine) && <Button size="sm" variant="outline" onClick={() => act("cash_requests", c.id, "close", true)}>Close</Button>}
              <Button size="sm" variant="ghost" onClick={() => setHist(c.id)}>Timeline</Button>
            </TableCell></TableRow>; })}</TableBody></Table></div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>{cur ? `Edit ${cur.request_number}` : "Cash advance request"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Requesting officer" name="officer_id" required options={d.officers.map((o) => ({ value: o.id, label: o.full_name }))} defaultValue={cur?.officer_id ?? me?.id ?? ""} />
          <SelectField label="Department" name="section_id" required options={d.sections.map((s) => ({ value: s.id, label: s.name }))} defaultValue={cur?.section_id ?? me?.section_id ?? ""} />
          <Field label="Purpose" name="purpose" required defaultValue={cur?.purpose} />
          <Field label="Amount requested (USD)" name="amount" type="number" required defaultValue={cur ? String(cur.amount) : ""} />
          <Field label="Date required" name="date_required" type="date" defaultValue={cur?.date_required ?? ""} />
          <div className="sm:col-span-2 space-y-1"><Label htmlFor="just">Justification</Label><Textarea id="just" name="justification" defaultValue={cur?.justification ?? ""} /></div>
          <Button type="submit" className="sm:col-span-2">Save draft</Button>
        </form></DialogContent></Dialog>
      <TimelineDialog d={d} module="cash_requests" id={hist} title="Approval timeline" onClose={() => setHist(null)} />
    </div>
  );
}

function ProcurementTab({ d }: { d: Data }) {
  const { hasAny, roles, session } = useAuth(); const qc = useQueryClient(); const act = useAct();
  const canCreate = hasAny([...FINANCE_STAFF, "section_head", "procurement_officer"]);
  const [edit, setEdit] = useState<ProcurementRequest | "new" | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const cur = edit && edit !== "new" ? edit : null;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const v = formValues(e.currentTarget);
    const rec = { section_id: v.section_id || null, item_description: v.item_description, quantity: Number(v.quantity), estimated_cost: Number(v.estimated_cost), vendor_id: v.vendor_id || null, funding_code: v.funding_code || null, budget_id: v.budget_id || null, is_ict: v.is_ict === "on" };
    const { error } = cur ? await supabase.from("procurement_funding").update(rec).eq("id", cur.id) : await supabase.from("procurement_funding").insert(rec);
    if (error) return toast.error(error.message);
    toast.success("Saved as draft"); setEdit(null); refreshFinance(qc);
  };
  void roles;
  return (
    <div className="space-y-3">
      <div className="flex justify-between flex-wrap gap-2"><p className="text-sm text-muted-foreground">Department → Procurement → Finance → Chief of ICT (ICT items) → Commandant → Approved</p><div className="flex gap-2"><ReportActions title="Procurement spending report" rows={d.procurement.map((p) => ({ No: p.request_number, Department: sectionName(d, p.section_id), Item: p.item_description, Qty: p.quantity, "Estimated cost": p.estimated_cost, Vendor: vendorName(d, p.vendor_id), "Funding code": p.funding_code, Status: p.status }))} />{canCreate && <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New request</Button>}</div></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Request No.</TableHead><TableHead>Department</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Est. cost</TableHead><TableHead>Vendor</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{d.procurement.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No procurement requests.</TableCell></TableRow>}
          {d.procurement.map((p) => { const mine = p.requested_by === session?.user.id; return <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.request_number}</TableCell><TableCell>{sectionName(d, p.section_id)}</TableCell><TableCell className="max-w-48 truncate">{p.item_description}{p.is_ict && <span className="ml-1 text-[10px] rounded bg-secondary px-1">ICT</span>}</TableCell><TableCell>{p.quantity}</TableCell><TableCell className="text-right">{money(p.estimated_cost)}</TableCell><TableCell>{vendorName(d, p.vendor_id)}</TableCell><TableCell><StatusBadge value={p.status} /><div className="text-[11px] text-muted-foreground">{PROCUREMENT_STAGES[p.stage]}</div></TableCell>
            <TableCell className="flex gap-1 justify-end flex-wrap">
              {p.stage === 0 && mine && <><Button size="icon" variant="ghost" aria-label="Edit request" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button><Button size="sm" onClick={() => act("procurement_funding", p.id, "submit")}>Submit</Button></>}
              {p.stage >= 1 && p.stage <= 5 && p.status !== "Rejected" && hasAny(PROCUREMENT_STAGE_ROLES[p.stage] ?? []) && <><Button size="sm" onClick={() => act("procurement_funding", p.id, "approve", true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => act("procurement_funding", p.id, "reject")}>Reject</Button></>}
              <Button size="sm" variant="ghost" onClick={() => setHist(p.id)}>Timeline</Button>
            </TableCell></TableRow>; })}</TableBody></Table></div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>{cur ? `Edit ${cur.request_number}` : "Procurement funding request"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Department" name="section_id" required options={d.sections.map((s) => ({ value: s.id, label: s.name }))} defaultValue={cur?.section_id ?? ""} />
          <SelectField label="Vendor" name="vendor_id" options={d.vendors.map((v) => ({ value: v.id, label: v.company_name ?? "Vendor" }))} defaultValue={cur?.vendor_id ?? ""} />
          <div className="sm:col-span-2"><Field label="Item description" name="item_description" required defaultValue={cur?.item_description} /></div>
          <Field label="Quantity" name="quantity" type="number" required defaultValue={String(cur?.quantity ?? 1)} />
          <Field label="Estimated cost (USD)" name="estimated_cost" type="number" required defaultValue={cur ? String(cur.estimated_cost) : ""} />
          <Field label="Funding code" name="funding_code" defaultValue={cur?.funding_code ?? ""} />
          <SelectField label="Budget line" name="budget_id" options={d.budgets.filter((b) => b.status === "Approved").map((b) => ({ value: b.id, label: `${b.budget_number} · ${b.category}` }))} defaultValue={cur?.budget_id ?? ""} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_ict" defaultChecked={cur?.is_ict ?? false} />ICT request (requires Chief of ICT approval)</label>
          <Button type="submit" className="sm:col-span-2">Save draft</Button>
        </form></DialogContent></Dialog>
      <TimelineDialog d={d} module="procurement_funding" id={hist} title="Approval timeline" onClose={() => setHist(null)} />
    </div>
  );
}

function ReportsTab({ d }: { d: Data }) {
  const { hasAny, session } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const inYear = (s: string | null) => !!s && new Date(s).getFullYear() === year;
  const inMonth = (s: string | null) => inYear(s) && new Date(s!).getMonth() === month;
  const approvedExp = d.expenses.filter((e) => e.status === "Approved");
  const reports = useMemo(() => ({
    "Budget report": d.budgets.filter((b) => b.fiscal_year === year).map((b) => ({ ID: b.budget_number, Department: sectionName(d, b.department), Category: b.category, Requested: num(b.requested_amount), Approved: num(b.allocated_amount), Spent: num(b.used_amount), Remaining: num(b.remaining_amount), Status: b.status })),
    "Revenue report": d.revenues.filter((r) => inYear(r.received_date)).map((r) => ({ No: r.revenue_number, Source: r.source, Date: r.received_date, Amount: num(r.amount) })),
    "Expenditure report": approvedExp.filter((e) => inYear(e.expense_date)).map((e) => ({ Ref: e.expense_number, Date: e.expense_date, Category: e.expense_type, Department: sectionName(d, e.section_id), Amount: num(e.amount) })),
    "Department spending report": d.sections.map((s) => ({ Department: s.name, Budget: d.budgets.filter((b) => b.department === s.id && b.fiscal_year === year && b.status === "Approved").reduce((t, b) => t + num(b.allocated_amount), 0), Spent: approvedExp.filter((e) => e.section_id === s.id && inYear(e.expense_date)).reduce((t, e) => t + num(e.amount), 0) })).filter((r) => r.Budget || r.Spent),
    "Procurement spending report": d.procurement.filter((p) => inYear(p.created_at)).map((p) => ({ No: p.request_number, Department: sectionName(d, p.section_id), Item: p.item_description, Cost: num(p.estimated_cost), Status: p.status })),
    "Annual financial report": [{ Year: year, Budget: d.budgets.filter((b) => b.fiscal_year === year && b.status === "Approved").reduce((t, b) => t + num(b.allocated_amount), 0), Revenue: d.revenues.filter((r) => inYear(r.received_date)).reduce((t, r) => t + num(r.amount), 0), Expenditure: approvedExp.filter((e) => inYear(e.expense_date)).reduce((t, e) => t + num(e.amount), 0), "Cash advances released": d.cash.filter((c) => c.stage >= 5 && inYear(c.created_at)).reduce((t, c) => t + num(c.amount), 0) }],
    "Monthly financial report": [{ Month: new Date(year, month, 1).toLocaleString("en", { month: "long", year: "numeric" }), Revenue: d.revenues.filter((r) => inMonth(r.received_date)).reduce((t, r) => t + num(r.amount), 0), Expenditure: approvedExp.filter((e) => inMonth(e.expense_date)).reduce((t, e) => t + num(e.amount), 0), "Expenses recorded": d.expenses.filter((e) => inMonth(e.expense_date)).length, "Cash requests": d.cash.filter((c) => inMonth(c.created_at)).length }],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [d, year, month]);
  const saveSnapshot = async (type: string, rows: Record<string, unknown>[]) => {
    if (!session) return;
    const { error } = await supabase.from("financial_reports").insert({ report_type: type, period_start: `${year}-01-01`, period_end: `${year}-12-31`, summary: rows as never, generated_by: session.user.id });
    if (error) toast.error(error.message); else toast.success("Report saved to the archive");
  };
  if (!hasAny(FINANCE_READERS)) return <p className="text-muted-foreground text-sm">Financial reports are available to Finance, the Commandant and Auditors.</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end"><div className="space-y-1"><Label htmlFor="ry">Year</Label><Input id="ry" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" /></div>
        <div className="space-y-1"><Label htmlFor="rm">Month</Label><select id="rm" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 border rounded-md bg-background px-2 text-sm">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString("en", { month: "long" })}</option>)}</select></div></div>
      <div className="grid md:grid-cols-2 gap-3">{Object.entries(reports).map(([title, rows]) => (
        <Card key={title}><CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap"><div><div className="font-medium">{title}</div><div className="text-xs text-muted-foreground">{rows.length} rows</div></div>
          <div className="flex gap-2 flex-wrap"><ReportActions title={`${title} ${year}`} rows={rows} />{hasAny([...FINANCE_STAFF, "commandant"]) && <Button size="sm" variant="ghost" onClick={() => saveSnapshot(title, rows)}>Save</Button>}</div></CardContent></Card>))}</div>
    </div>
  );
}

const FIN_TABLES = ["budgets", "budget_allocations", "expenses", "revenues", "cash_requests", "procurement_funding", "finance_approvals", "financial_reports"];
function AuditTab() {
  const { hasAny } = useAuth();
  const allowed = hasAny(["auditor", "finance_admin", "commandant", "deputy_commandant", "dc_admin"]);
  const { data, error } = useQuery({
    queryKey: ["finance-audit"], enabled: allowed,
    queryFn: async () => { const r = await supabase.from("audit_logs").select("*").in("table_name", FIN_TABLES).order("created_at", { ascending: false }).limit(300); if (r.error) throw r.error; return r.data; },
  });
  if (!allowed) return <p className="text-muted-foreground text-sm">The finance audit trail is available to Auditors, the Finance Administrator and leadership.</p>;
  if (error) return <p className="text-destructive text-sm">{(error as Error).message}</p>;
  const changes = (prev: unknown, next: unknown) => {
    if (!prev || !next) return "";
    const p = prev as Record<string, unknown>, n = next as Record<string, unknown>;
    return Object.keys(n).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(n[k]) && k !== "history").map((k) => `${k}: ${JSON.stringify(p[k])} → ${JSON.stringify(n[k])}`).join("; ");
  };
  const rows = (data ?? []).map((a) => ({ User: a.user_email ?? "system", Action: a.action, Record: a.table_name.replace(/_/g, " "), Date: new Date(a.created_at).toLocaleDateString(), Time: new Date(a.created_at).toLocaleTimeString(), Changes: changes(a.previous_details, a.details) }));
  return (
    <div className="space-y-3">
      <div className="flex justify-between flex-wrap gap-2"><p className="text-sm text-muted-foreground">Audit records are permanent and cannot be edited or deleted.</p><ReportActions title="Finance audit trail" rows={rows} /></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Previous → new value</TableHead></TableRow></TableHeader>
        <TableBody>{rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No finance activity yet.</TableCell></TableRow>}
          {rows.map((r, i) => <TableRow key={i}><TableCell className="text-xs">{r.User}</TableCell><TableCell>{r.Action}</TableCell><TableCell className="capitalize">{r.Record}</TableCell><TableCell>{r.Date}</TableCell><TableCell>{r.Time}</TableCell><TableCell className="text-xs max-w-md break-words">{r.Changes || "—"}</TableCell></TableRow>)}</TableBody></Table></div>
    </div>
  );
}
