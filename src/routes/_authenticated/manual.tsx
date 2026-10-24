import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import sections from "@/lib/manual-content.json";

export const Route = createFileRoute("/_authenticated/manual")({
  head: () => ({ meta: [{ title: "User Manual — LNPATS ERP" }, { name: "description", content: "Illustrated step-by-step guide to every LNPATS ERP module." }, { property: "og:title", content: "User Manual — LNPATS ERP" }, { property: "og:description", content: "Illustrated step-by-step guide to every LNPATS ERP module." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Manual,
});

function Manual() {
  const [q, setQ] = useState("");
  const list = sections.filter((s) => `${s.title} ${s.intro} ${s.steps.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="User Manual" subtitle="Step-by-step guide to every part of the LNPATS ERP"
        actions={<Button asChild variant="outline"><a href="/manual/LNPATS-ERP-User-Manual.pdf" download>Download PDF</a></Button>} />
      <Input placeholder="Search the manual…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-4" />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block sticky top-4 self-start space-y-1 text-sm">
          {list.map((s, i) => <a key={s.id} href={`#${s.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">{i + 1}. {s.title}</a>)}
        </nav>
        <div className="space-y-6 min-w-0">
          {list.map((s, i) => (
            <Card key={s.id} id={s.id} className="p-5 scroll-mt-4">
              <h2 className="text-xl font-semibold">{i + 1}. {s.title}</h2>
              <p className="text-xs text-muted-foreground mb-2">Who uses it: {s.who}</p>
              <p className="mb-3">{s.intro}</p>
              <img src={`/manual/${s.image}.jpg`} alt={`${s.title} screen`} loading="lazy" className="w-full rounded border mb-3" />
              <ol className="list-decimal pl-5 space-y-1">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>
              {s.tips.length > 0 && <div className="mt-3 rounded bg-muted p-3 text-sm">{s.tips.map((t) => <p key={t}>Tip: {t}</p>)}</div>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
