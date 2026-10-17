import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LNPATS ERP — Liberia National Police Academy" },
      { name: "description", content: "Secure management system for officers, leave, logistics and training at LNPATS." },
      { property: "og:title", content: "LNPATS ERP — Liberia National Police Academy" },
      { property: "og:description", content: "Secure management system for officers, leave, logistics and training at LNPATS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="stripe-band" />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <Logo className="h-36 w-36 ring-4 ring-gold" />
        <p className="mt-8 text-xs uppercase tracking-[0.3em] text-sidebar-primary">Republic of Liberia</p>
        <h1 className="mt-3 text-3xl md:text-5xl font-extrabold max-w-3xl">
          Liberia National Police Academy and Training School
        </h1>
        <p className="mt-4 text-sidebar-foreground/75 max-w-xl">
          Enterprise Resource Planning — officers, leave, logistics, training and administration in one secure system.
        </p>
        <div className="mt-8">
          {session ? (
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth">Staff sign in</Link>
            </Button>
          )}
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-sidebar-foreground/60">Authorised personnel only · All actions are logged</footer>
    </div>
  );
}
