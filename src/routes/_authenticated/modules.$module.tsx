import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/AppShell";

const INFO: Record<string, { title: string; features: string[] }> = {
  training: { title: "Training Management", features: ["Cadet registration", "Training programs & courses", "Attendance", "Assessments & examinations", "Results & graduation", "Certification"] },
  finance: { title: "Finance Management", features: ["Budget planning", "Cash & procurement requests", "Expense & revenue tracking", "Approvals workflow", "Budget monitoring"] },
  procurement: { title: "Procurement Management", features: ["Vendor database", "Quotation comparison", "Purchase requests & orders", "Goods received notes", "Contracts"] },
  transport: { title: "Transport Management", features: ["Vehicle registry", "Fuel consumption", "Maintenance records", "Driver assignment", "Bookings & journey logs"] },
  hr: { title: "HR Management", features: ["Recruitment", "Promotions & transfers", "Performance appraisal", "Attendance", "Payroll integration"] },
  ict: { title: "ICT Helpdesk", features: ["Ticketing", "Incident reports", "System & equipment requests", "Network monitoring", "ICT asset register"] },
  documents: { title: "Document Management", features: ["Incoming & outgoing correspondence", "Digital registry", "File tracking", "Document approvals", "Archive"] },
};

export const Route = createFileRoute("/_authenticated/modules/$module")({
  head: ({ params }) => {
    const title = `${INFO[params.module]?.title ?? "Module"} — LNPATS ERP`;
    const description = `${INFO[params.module]?.title ?? "Academy module"} planning for LNPATS.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  component: ModulePage,
});

function ModulePage() {
  const { module } = Route.useParams();
  const info = INFO[module] ?? { title: "Module", features: [] };
  return (
    <div>
      <PageHeader title={info.title} subtitle="Scheduled for the next build phase" />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">This module is planned and will include:</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {info.features.map((f) => <li key={f} className="rounded-md border px-3 py-2 text-sm">{f}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
