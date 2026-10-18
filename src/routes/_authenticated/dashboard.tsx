import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, CalendarDays, PackageSearch, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { LEAVE_STAGE_ROLES, SUPPLY_STAGE_ROLES } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LNPATS ERP" }, { name: "description", content: "Command overview of LNPATS officers, leave, supply requests, and inventory." }, { property: "og:title", content: "Dashboard — LNPATS ERP" }, { property: "og:description", content: "Command overview of LNPATS officers, leave, supply requests, and inventory." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const { hasAny } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [o, l, s, i, a] = await Promise.all([
        supabase.from("officers").select("id, rank, employment_status, sections(name)"),
        supabase.from("leave_requests").select("id, leave_type, status, stage, created_at, officers!officer_id(full_name)").order("created_at", { ascending: false }),
        supabase.from("supply_requests").select("id, request_number, item_name, stage, approval_status, collection_status, priority, created_at").order("created_at", { ascending: false }),
        supabase.from("inventory_items").select("id, name, quantity, reorder_level, is_asset"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      return { officers: o.data ?? [], leave: l.data ?? [], supply: s.data ?? [], inv: i.data ?? [], audit: a.data ?? [] };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_requests" }, () => qc.invalidateQueries({ queryKey: ["dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => qc.invalidateQueries({ queryKey: ["dashboard"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (!data) return <p className="text-muted-foreground">Loading dashboard…</p>;
  const pendingLeave = data.leave.filter((l) => l.status === "Pending");
  const openSupply = data.supply.filter((s) => s.approval_status !== "Rejected" && s.stage < 8);
  const lowStock = data.inv.filter((i) => !i.is_asset && i.quantity <= i.reorder_level);
  const myLeave = pendingLeave.filter((l) => hasAny(LEAVE_STAGE_ROLES[l.stage] ?? []));
  const mySupply = openSupply.filter((s) => hasAny(SUPPLY_STAGE_ROLES[s.stage] ?? []));

  const byRank = Object.entries(data.officers.reduce<Record<string, number>>((m, o) => ((m[o.rank] = (m[o.rank] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const byLeaveType = Object.entries(data.leave.reduce<Record<string, number>>((m, l) => ((m[l.leave_type] = (m[l.leave_type] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const stockChart = data.inv.filter((i) => !i.is_asset).map((i) => ({ name: i.name.split(" ").slice(0, 2).join(" "), qty: i.quantity, reorder: i.reorder_level }));

  const kpis = [
    { label: "Officers", value: data.officers.length, sub: `${data.officers.filter((o) => o.employment_status === "Active").length} active`, icon: Users },
    { label: "Pending leave", value: pendingLeave.length, sub: `${myLeave.length} awaiting you`, icon: CalendarDays },
    { label: "Open supply requests", value: openSupply.length, sub: `${mySupply.length} awaiting you`, icon: PackageSearch },
    { label: "Low stock alerts", value: lowStock.length, sub: "at or below reorder level", icon: AlertTriangle },
  ];

  return (
    <div>
      <PageHeader title="Command Dashboard" subtitle="Live overview of the Academy — updates automatically" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className="text-3xl font-display font-bold mt-1">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>
              </div>
              <k.icon className="h-5 w-5 text-gold" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Inventory levels vs reorder point</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={stockChart}>
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="qty" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reorder" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Leave by type</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byLeaveType} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} label={({ name }) => name} fontSize={11}>
                  {byLeaveType.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Awaiting your action</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {myLeave.length + mySupply.length === 0 && <p className="text-muted-foreground">Nothing pending for your role.</p>}
            {myLeave.map((l) => (
              <Link key={l.id} to="/leave" className="flex justify-between rounded-md border p-2 hover:bg-muted">
                <span>{l.leave_type} leave · {l.officers?.full_name}</span><StatusBadge value="Pending" />
              </Link>
            ))}
            {mySupply.map((s) => (
              <Link key={s.id} to="/supplies" className="flex justify-between rounded-md border p-2 hover:bg-muted">
                <span>{s.request_number} · {s.item_name}</span><StatusBadge value={s.priority} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Officers by rank</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={byRank} layout="vertical">
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.audit.length === 0 && <p className="text-muted-foreground">Activity is visible to the Commandant and Deputy Commissioners.</p>}
            {data.audit.map((a) => (
              <div key={a.id} className="flex justify-between gap-2 border-b pb-1">
                <span className="truncate">{a.user_email ?? "system"} · {a.action.toLowerCase()} {a.table_name.replace("_", " ")}</span>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
