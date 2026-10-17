import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/AppShell";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit Log — LNPATS ERP" }] }),
  component: Audit,
});

function Audit() {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const rows = data.filter((r) => `${r.user_email} ${r.action} ${r.table_name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every create, update and delete is recorded automatically"
        actions={<Button variant="outline" onClick={() => exportCsv("audit-log.csv", rows.map(({ details, ...r }) => r))}>Export CSV</Button>} />
      <Input placeholder="Filter by user, action or area…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-4" />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Area</TableHead><TableHead>Record</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No entries visible. Audit records are visible to the Commandant, Deputy Commandant, DC Admin and System Administrators.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.user_email ?? "system"}</TableCell>
                <TableCell>{r.action}</TableCell>
                <TableCell>{r.table_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{r.record_id?.slice(0, 8)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
