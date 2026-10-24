import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MetricBand, ReportActions } from "./Phase2Shared";
import { resolutionHours, recordDetails, type ICTData } from "@/lib/ict";
function counts(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((a, v) => {
      a[v] = (a[v] ?? 0) + 1;
      return a;
    }, {}),
  ).map(([name, total]) => ({ name, total }));
}
export function ICTOverview({ d }: { d: ICTData }) {
  const network = d.records.filter((r) => r.kind === "network");
  const resolved = d.tickets.filter((t) => t.resolved_at);
  const charts = [
    { title: "Ticket trends", data: counts(d.tickets.map((t) => t.created_at.slice(0, 10))) },
    {
      title: "Incident categories",
      data: counts(d.records.filter((r) => r.kind === "incidents").map((r) => r.category)),
    },
    {
      title: "Resolution time analysis (hours)",
      data: resolved.map((t) => ({
        name: t.ticket_number,
        total: Number(resolutionHours(t.created_at, t.resolved_at)?.toFixed(1)),
      })),
    },
    { title: "ICT asset distribution", data: counts(d.assets.map((a) => a.category ?? "Other")) },
    { title: "Network performance · recorded status", data: counts(network.map((r) => r.status)) },
  ];
  return (
    <div>
      <MetricBand
        items={[
          {
            label: "Open tickets",
            value: d.tickets.filter((t) => !["Resolved", "Closed"].includes(t.status ?? "Open"))
              .length,
          },
          {
            label: "In progress",
            value: d.tickets.filter((t) => t.status === "In Progress").length,
          },
          {
            label: "Resolved tickets",
            value: d.tickets.filter((t) => ["Resolved", "Closed"].includes(t.status ?? "")).length,
          },
          {
            label: "Critical incidents",
            value: d.records.filter(
              (r) => r.kind === "incidents" && r.priority === "Critical" && r.status !== "Closed",
            ).length,
          },
          { label: "ICT assets", value: d.assets.length },
          {
            label: "Active users (registry)",
            value: d.records.filter((r) => r.kind === "accounts" && r.status === "Active").length,
          },
          { label: "Network devices", value: network.length },
          { label: "System uptime", value: "Not connected" },
        ]}
      />
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
        {charts.map((c) => (
          <section className="border-b pb-5 min-w-0 overflow-hidden" key={c.title}>
            <h2 className="font-semibold mb-3">{c.title}</h2>
            {c.data.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={c.data} layout="vertical" margin={{ right: 16 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="var(--chart-1)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground">
                No records yet.
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
export function ICTReports({ d }: { d: ICTData }) {
  const sections = [
    {
      title: "Helpdesk Report",
      rows: d.tickets.map((t) => ({
        Number: t.ticket_number,
        Subject: t.subject,
        Category: t.issue_type,
        Priority: t.priority,
        Status: t.status,
        Submitted: t.created_at,
        Resolved: t.resolved_at,
        ResolutionHours: resolutionHours(t.created_at, t.resolved_at),
      })),
    },
    {
      title: "Incident Report",
      rows: d.records
        .filter((r) => r.kind === "incidents")
        .map((r) => ({
          Number: r.number,
          Title: r.title,
          Category: r.category,
          Status: r.status,
          ...recordDetails(r.details),
        })),
    },
    {
      title: "Asset Report",
      rows: d.assets.map((a) => ({
        Number: a.asset_number,
        Name: a.asset_name,
        Type: a.category,
        Serial: a.serial_number,
        Status: a.asset_status,
      })),
    },
    {
      title: "User Account Report",
      rows: d.records
        .filter((r) => r.kind === "accounts")
        .map((r) => ({ Number: r.number, Account: r.title, Type: r.category, Status: r.status })),
    },
    {
      title: "Network Health Report",
      rows: d.records
        .filter((r) => r.kind === "network")
        .map((r) => ({ Device: r.title, Status: r.status, ...recordDetails(r.details) })),
    },
    {
      title: "Downtime Report",
      rows: d.records
        .filter((r) => r.kind === "network")
        .flatMap((r) =>
          Array.isArray(r.history)
            ? r.history
                .filter(
                  (e) =>
                    e && typeof e === "object" && !Array.isArray(e) && e["status"] === "Offline",
                )
                .map((e) => ({ Device: r.title, ...recordDetails(e) }))
            : [],
        ),
    },
    {
      title: "Maintenance Report",
      rows: d.maintenance.map((m) => ({
        Number: m.maintenance_number,
        Date: m.maintenance_date,
        Type: m.maintenance_type,
        Status: m.status,
        Findings: m.findings,
        Action: m.action_taken,
      })),
    },
  ];
  return (
    <div className="divide-y">
      {sections.map((s) => (
        <section key={s.title} className="flex justify-between items-center flex-wrap gap-3 py-5">
          <div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-xs text-muted-foreground">{s.rows.length} records</p>
          </div>
          <ReportActions title={s.title} rows={s.rows} />
        </section>
      ))}
    </div>
  );
}
