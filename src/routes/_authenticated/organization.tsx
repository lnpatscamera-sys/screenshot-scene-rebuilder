import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({ meta: [{ title: "Organization — LNPATS ERP" }, { name: "description", content: "View the LNPATS command hierarchy, offices, and sections." }, { property: "og:title", content: "Organization — LNPATS ERP" }, { property: "og:description", content: "View the LNPATS command hierarchy, offices, and sections." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Org,
});

function Org() {
  const { data } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const [o, s] = await Promise.all([supabase.from("offices").select("*").order("rank_order"), supabase.from("sections").select("*").order("name")]);
      return { offices: o.data ?? [], sections: s.data ?? [] };
    },
  });
  return (
    <div>
      <PageHeader title="Organizational Structure" subtitle="Command hierarchy and sections of LNPATS" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Command hierarchy</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {data?.offices.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3" style={{ paddingLeft: Math.min(i, 4) * 16 }}>
                  <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">{o.rank_order}</span>
                  <span className="text-sm">{o.name}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sections ({data?.sections.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {data?.sections.map((s) => <div key={s.id} className="rounded-md border px-3 py-2 text-sm">{s.name}</div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
