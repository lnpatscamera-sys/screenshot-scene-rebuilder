import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LNPATS ERP" },
      { name: "description", content: "Staff sign in for the LNPATS management system." },
      { property: "og:title", content: "Sign in — LNPATS ERP" },
      { property: "og:description", content: "Staff sign in for the LNPATS management system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) nav({ to: "/dashboard", replace: true });
  }, [session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else toast.success("Check your email to confirm your account.");
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col items-center justify-center bg-sidebar text-sidebar-foreground p-10 text-center">
        <Logo className="h-40 w-40 ring-4 ring-gold" />
        <h2 className="mt-6 text-2xl font-bold">LNPATS ERP</h2>
        <p className="mt-2 text-sm text-sidebar-foreground/70 max-w-xs">Liberia National Police Academy and Training School</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="md:hidden flex justify-center"><Logo className="h-20 w-20" /></div>
          <h1 className="text-2xl font-bold">{mode === "in" ? "Staff sign in" : "Create staff account"}</h1>
          {mode === "up" && (
            <div className="space-y-1"><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Password</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
          <Button type="button" variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <button type="button" className="text-sm text-muted-foreground underline w-full" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New staff member? Create an account" : "Already have an account? Sign in"}
          </button>
          <p className="text-xs text-muted-foreground text-center">New accounts start as Officer. A System Administrator assigns other roles.</p>
        </form>
      </div>
    </div>
  );
}
