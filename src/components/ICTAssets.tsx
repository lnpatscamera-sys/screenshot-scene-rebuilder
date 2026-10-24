import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ASSET_TYPES, ictAction, type ICTData } from "@/lib/ict";
import { HRTable } from "./HRShared";
import { ICTForm, ICTDetail, type FormField } from "./ICTShared";
import { options } from "./ProcurementShared";
import { Button } from "./ui/button";
import { StatusBadge } from "./AppShell";
export function ICTAssets({ d, maintenance = false }: { d: ICTData; maintenance?: boolean }) {
  const { hasAny } = useAuth();
  const staff = hasAny(["ict_admin"]);
  const [view, setView] = useState<{ title: string; values: Record<string, unknown> } | null>(null);
  const [form, setForm] = useState<{
    title: string;
    fields: FormField[];
    module: string;
    id: string | null;
    action: string;
  } | null>(null);
  const people = d.directory.map((o) => ({ value: o.id, label: o.full_name }));
  const person = (id: string | null) => d.directory.find((o) => o.id === id)?.full_name ?? "—";
  const asset = (id: string | null) => d.assets.find((a) => a.id === id)?.asset_name ?? "—";
  const assetReport = (a: ICTData["assets"][number]) => ({
    Number: a.asset_number,
    Name: a.asset_name,
    Type: a.category,
    Serial: a.serial_number,
    Brand: a.brand,
    Model: a.model,
    Department: d.offices.find((o) => o.id === a.department_id)?.name,
    Assigned: person(a.assigned_to),
    Purchased: a.purchase_date,
    Warranty: a.warranty_expiry,
    Status: a.asset_status,
  });
  const mReport = (m: ICTData["maintenance"][number]) => ({
    Number: m.maintenance_number,
    Asset: asset(m.asset_id),
    Type: m.maintenance_type,
    Date: m.maintenance_date,
    Technician: person(m.technician_id),
    Findings: m.findings,
    Action: m.action_taken,
    Status: m.status,
  });
  return (
    <div>
      {maintenance ? (
        <HRTable
          title="Maintenance"
          rows={d.maintenance}
          report={mReport}
          columns={[
            { label: "Number", render: (m) => m.maintenance_number },
            { label: "Asset", render: (m) => asset(m.asset_id) },
            { label: "Type", render: (m) => m.maintenance_type },
            { label: "Date", render: (m) => m.maintenance_date },
            { label: "Status", render: (m) => <StatusBadge value={m.status} /> },
          ]}
          onView={(m) =>
            setView({ title: m.maintenance_number ?? "Maintenance", values: mReport(m) })
          }
          onNew={
            staff
              ? () =>
                  setForm({
                    title: "Schedule maintenance",
                    module: "maintenance",
                    id: null,
                    action: "create",
                    fields: [
                      {
                        name: "asset_id",
                        label: "Asset",
                        options: d.assets.map((a) => ({
                          value: a.id,
                          label: a.asset_name ?? a.asset_number ?? a.id,
                        })),
                        required: true,
                      },
                      {
                        name: "maintenance_type",
                        label: "Maintenance type",
                        options: options(["Preventive", "Corrective"]),
                        required: true,
                      },
                      { name: "maintenance_date", label: "Date", type: "date", required: true },
                      {
                        name: "technician_id",
                        label: "Technician",
                        options: d.directory
                          .filter((o) => o.is_technician)
                          .map((o) => ({ value: o.id, label: o.full_name })),
                        required: true,
                      },
                      {
                        name: "description",
                        label: "Work planned",
                        type: "textarea",
                        required: true,
                      },
                    ],
                  })
              : undefined
          }
          actions={(m) =>
            staff &&
            m.status === "Scheduled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    title: "Record maintenance",
                    module: "maintenance",
                    id: m.id,
                    action: "complete",
                    fields: [
                      { name: "findings", label: "Findings", type: "textarea", required: true },
                      {
                        name: "action_taken",
                        label: "Action taken",
                        type: "textarea",
                        required: true,
                      },
                    ],
                  })
                }
              >
                Complete
              </Button>
            )
          }
        />
      ) : (
        <HRTable
          title="ICT assets"
          rows={d.assets}
          report={assetReport}
          columns={[
            {
              label: "Asset",
              render: (a) => (
                <div>
                  <div className="text-xs text-muted-foreground">{a.asset_number}</div>
                  <div className="font-medium">{a.asset_name}</div>
                </div>
              ),
            },
            { label: "Type", render: (a) => a.category },
            { label: "Serial", render: (a) => a.serial_number },
            { label: "Assigned user", render: (a) => person(a.assigned_to) },
            { label: "Status", render: (a) => <StatusBadge value={a.asset_status} /> },
          ]}
          onNew={
            staff
              ? () =>
                  setForm({
                    title: "Register ICT asset",
                    module: "assets",
                    id: null,
                    action: "create",
                    fields: [
                      { name: "asset_name", label: "Asset name", required: true },
                      {
                        name: "category",
                        label: "Asset type",
                        options: options(ASSET_TYPES),
                        required: true,
                      },
                      { name: "serial_number", label: "Serial number", required: true },
                      { name: "brand", label: "Brand" },
                      { name: "model", label: "Model" },
                      {
                        name: "department_id",
                        label: "Department",
                        options: d.offices.map((o) => ({ value: o.id, label: o.name })),
                      },
                      { name: "purchase_date", label: "Purchase date", type: "date" },
                      { name: "warranty_expiry", label: "Warranty expiry", type: "date" },
                    ],
                  })
              : undefined
          }
          onView={(a) =>
            setView({
              title: a.asset_name ?? "Asset",
              values: {
                ...assetReport(a),
                Assignments:
                  d.assignments
                    .filter((x) => x.asset_id === a.id)
                    .map(
                      (x) =>
                        `${x.assigned_date}: ${person(x.officer_id)}${x.returned_date ? ` (returned ${x.returned_date})` : ""}`,
                    )
                    .join("\n") || "—",
                Transfers:
                  d.transfers
                    .filter((x) => x.asset_id === a.id)
                    .map(
                      (x) =>
                        `${x.transfer_date}: ${person(x.from_officer_id)} → ${person(x.to_officer_id)} · ${x.reason}`,
                    )
                    .join("\n") || "—",
                Maintenance:
                  d.maintenance
                    .filter((x) => x.asset_id === a.id)
                    .map((x) => `${x.maintenance_date}: ${x.maintenance_type} · ${x.status}`)
                    .join("\n") || "—",
              },
            })
          }
          actions={(a) =>
            staff &&
            a.asset_status !== "Retired" && (
              <>
                {["assign", "transfer", "retire"].map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        title: `${action} asset`,
                        module: "assets",
                        id: a.id,
                        action,
                        fields:
                          action === "retire"
                            ? [
                                {
                                  name: "note",
                                  label: "Retirement reason",
                                  required: true,
                                  type: "textarea",
                                },
                              ]
                            : [
                                {
                                  name: "officer_id",
                                  label: "Assigned user",
                                  options: people,
                                  required: true,
                                },
                                {
                                  name: "section_id",
                                  label: "Section",
                                  options: d.sections.map((s) => ({ value: s.id, label: s.name })),
                                  required: true,
                                },
                                {
                                  name: "note",
                                  label: action === "transfer" ? "Transfer reason" : "Notes",
                                  type: "textarea",
                                  required: action === "transfer",
                                },
                              ],
                      })
                    }
                  >
                    {action === "assign" ? "Assign" : action === "transfer" ? "Transfer" : "Retire"}
                  </Button>
                ))}
              </>
            )
          }
        />
      )}{" "}
      {form && (
        <ICTForm
          title={form.title}
          fields={form.fields}
          onClose={() => setForm(null)}
          onSave={async (v) => {
            await ictAction(form.module, form.id, form.action, v);
          }}
        />
      )}
      {view && <ICTDetail title={view.title} values={view.values} onClose={() => setView(null)} />}
    </div>
  );
}
