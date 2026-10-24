import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  ICT_PRIORITIES,
  INCIDENT_CATEGORIES,
  SERVICE_TYPES,
  ictAction,
  recordDetails,
  type ICTData,
  type ICTRecord,
} from "@/lib/ict";
import { HRTable } from "./HRShared";
import { ICTForm, ICTDetail, type FormField } from "./ICTShared";
import { options } from "./ProcurementShared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusBadge } from "./AppShell";
export type ICTKind = "requests" | "incidents" | "network" | "accounts" | "knowledge";
const titles = {
  requests: "Service requests",
  incidents: "Incidents",
  network: "Network devices",
  accounts: "User accounts",
  knowledge: "Knowledge articles",
};
export function ICTRecords({ d, kind }: { d: ICTData; kind: ICTKind }) {
  const { hasAny } = useAuth();
  const staff = hasAny(["ict_admin"]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<ICTRecord | null>(null);
  const [form, setForm] = useState<{
    title: string;
    fields: FormField[];
    record: ICTRecord | null;
    action: string;
    files?: boolean;
  } | null>(null);
  const rows = d.records.filter((r) => r.kind === kind);
  const person = (id: string | null) => d.directory.find((o) => o.id === id)?.full_name ?? "—";
  const report = (r: ICTRecord) => ({
    Number: r.number,
    Title: r.title,
    Category: r.category,
    Priority: r.priority,
    Status: r.status,
    Requester: person(r.officer_id),
    Technician: person(r.technician_id),
    ...recordDetails(r.details),
  });
  const create = () => {
    let fields: FormField[] = [
      {
        name: "title",
        label:
          kind === "network" ? "Device name" : kind === "accounts" ? "Account username" : "Title",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        required: true,
        options: options(
          kind === "requests"
            ? SERVICE_TYPES
            : kind === "incidents"
              ? INCIDENT_CATEGORIES
              : kind === "network"
                ? ["Router", "Switch", "Internet Link", "WiFi Access Point", "Server"]
                : kind === "accounts"
                  ? ["LNPATS Email", "ERP", "Active Directory", "WiFi"]
                  : [
                      "User Guides",
                      "ICT Policies",
                      "ERP Guides",
                      "Troubleshooting Guides",
                      "Network Documentation",
                      "Software Manuals",
                    ],
        ),
      },
    ];
    if (kind === "requests" || kind === "incidents")
      fields.push(
        {
          name: "priority",
          label: kind === "incidents" ? "Impact level" : "Priority",
          options: options(ICT_PRIORITIES),
          value: "Medium",
          required: true,
        },
        { name: "description", label: "Description", type: "textarea", required: true },
      );
    if (kind === "incidents" || kind === "network")
      fields.push({ name: "location", label: "Location", required: true });
    if (kind === "network")
      fields.push({ name: "ip_address", label: "IP address", required: true });
    if (kind === "accounts")
      fields.push({
        name: "assigned_user",
        label: "Assigned user",
        options: d.directory.map((o) => ({ value: o.id, label: o.full_name })),
        required: true,
      });
    if (kind === "knowledge")
      fields.push({ name: "content", label: "Article", type: "textarea", required: true });
    setForm({
      title: `Add ${titles[kind].toLowerCase().replace(/s$/, "")}`,
      fields,
      record: null,
      action: "create",
      files: kind === "knowledge",
    });
  };
  const action = (r: ICTRecord, a: string) => {
    const fields: FormField[] =
      a === "assign"
        ? [
            {
              name: "technician_id",
              label: "Technician",
              options: d.directory
                .filter((o) => o.is_technician)
                .map((o) => ({ value: o.id, label: o.full_name })),
              required: true,
            },
          ]
        : a === "close"
          ? [
              { name: "root_cause", label: "Root cause", type: "textarea", required: true },
              { name: "resolution", label: "Resolution", type: "textarea", required: true },
            ]
          : a === "check_in"
            ? [
                {
                  name: "status",
                  label: "Online status",
                  options: options(["Online", "Offline", "Degraded", "Unknown"]),
                  required: true,
                },
                { name: "latency_ms", label: "Latency (ms)", type: "number", min: 0 },
                { name: "note", label: "Observation", type: "textarea" },
              ]
            : [
                {
                  name: "note",
                  label:
                    a === "complete"
                      ? "Completion report"
                      : a === "login_event"
                        ? "Login history entry (date, result, source)"
                        : a === "reset_request"
                          ? "Password reset request"
                          : a === "unlock_request"
                            ? "Unlock request"
                            : "Comment",
                  type: "textarea",
                  required: [
                    "complete",
                    "reject",
                    "login_event",
                    "reset_request",
                    "unlock_request",
                  ].includes(a),
                },
              ];
    setForm({ title: `${a.replaceAll("_", " ")} · ${r.number}`, fields, record: r, action: a });
  };
  const actions = (r: ICTRecord) => {
    const list: string[] = [];
    if (kind === "requests") {
      if (r.status === "Pending Supervisor") list.push("approve", "reject");
      if (staff && ["Pending ICT", "Assigned"].includes(r.status)) list.push("assign");
      if (staff && r.status === "Assigned") list.push("complete");
    } else if (staff) {
      if (kind === "incidents" && r.status !== "Closed") list.push("escalate", "close");
      if (kind === "knowledge" && r.status === "Draft") list.push("publish");
      if (kind === "network") list.push("check_in");
      if (kind === "accounts")
        list.push(
          r.status === "Disabled" ? "activate" : "disable",
          "reset_request",
          "unlock_request",
          "login_event",
        );
    }
    return list.map((a) => (
      <Button key={a} size="sm" variant="outline" onClick={() => action(r, a)}>
        {
          (
            {
              approve: "Approve",
              reject: "Reject",
              assign: "Assign",
              complete: "Complete",
              escalate: "Escalate",
              close: "Close",
              publish: "Publish",
              check_in: "Check-in",
              disable: "Disable record",
              activate: "Activate record",
              reset_request: "Request reset",
              unlock_request: "Request unlock",
              login_event: "Log event",
            } as Record<string, string>
          )[a]
        }
      </Button>
    ));
  };
  return (
    <div className="space-y-4">
      {kind === "network" && (
        <p className="text-sm text-muted-foreground">
          Monitoring provider not connected · Check-ins are manually recorded.
        </p>
      )}
      {kind === "accounts" && (
        <p className="text-sm text-muted-foreground">
          Account provider not connected · Changes update this registry only; resets and unlocks
          remain requests.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <Input
          aria-label={`Search ${titles[kind]}`}
          placeholder="Search records…"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter records"
          className="border bg-background rounded-md px-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Array.from(new Set(rows.map((r) => r.status))).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <HRTable
        title={titles[kind]}
        rows={rows.filter(
          (r) =>
            (!filter || r.status === filter) &&
            JSON.stringify(report(r)).toLowerCase().includes(search.toLowerCase()),
        )}
        columns={[
          {
            label: "Record",
            render: (r) => (
              <div>
                <span className="text-xs text-muted-foreground">{r.number}</span>
                <div className="font-medium max-w-64 break-words">{r.title}</div>
              </div>
            ),
          },
          { label: "Category", render: (r) => r.category },
          { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
          {
            label: kind === "network" ? "Last check-in" : "Priority",
            render: (r) =>
              kind === "network" ? (recordDetails(r.details)["last_check_in"] ?? "—") : r.priority,
          },
        ]}
        report={report}
        onNew={staff || kind === "requests" ? create : undefined}
        onView={setView}
        actions={actions}
      />
      {form && (
        <ICTForm
          title={form.title}
          fields={form.fields}
          attachments={form.files ?? false}
          onClose={() => setForm(null)}
          onSave={async (v, files) => {
            await ictAction(kind, form.record?.id ?? null, form.action, {
              ...v,
              ...(form.files ? { attachments: files } : {}),
            });
          }}
        />
      )}
      {view && (
        <ICTDetail
          title={view.title}
          values={report(view)}
          history={view.history}
          attachments={view.attachments}
          onClose={() => setView(null)}
        />
      )}
    </div>
  );
}
