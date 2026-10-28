import { useServerFn } from "@tanstack/react-start";
import { looksLikeEmail } from "@/lib/enrollment";
import { requestPasswordReset, signInWithLnpId } from "@/lib/enrollment.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const lnpSignIn = useServerFn(signInWithLnpId);
  const resetFn = useServerFn(requestPasswordReset);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (session) nav({ to: "/dashboard", replace: true });
  }, [session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (looksLikeEmail(username)) {
        const { error } = await supabase.auth.signInWithPassword({ email: username.trim(), password });
        if (error) toast.error(error.message);
      } else {
        const r = await lnpSignIn({ data: { lnpId: username, password } });
        if ("error" in r) toast.error(r.error);
        else {
          const { error } = await supabase.auth.setSession(r);
          if (error) toast.error(error.message);
        }
      }
    } catch { toast.error("Sign-in failed. Try again."); }
    setBusy(false);
  };

  const forgot = async () => {
    if (!username.trim()) { toast.error("Enter your LNP ID Number in User name first."); return; }
    setBusy(true);
    try {
      await resetFn({ data: { lnpId: username.trim(), origin: window.location.origin } });
      toast.success("If this LNP ID Number has an account, a password reset link has been sent to its email.");
    } catch { toast.error("Could not send the reset link. Try again."); }
    setBusy(false);
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
          <h1 className="text-2xl font-bold">Staff sign in</h1>
          <div className="space-y-1"><Label htmlFor="auth-user">User name (LNP ID Number)</Label><Input id="auth-user" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="auth-pass">Password</Label><Input id="auth-pass" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          <button type="button" className="block w-full text-sm text-primary underline-offset-4 hover:underline" onClick={forgot}>Forgot password?</button>
          <p className="text-xs text-muted-foreground text-center">Accounts are opened by the Human Resources Section only. Contact HR if you do not have one.</p>
        </form>
      </div>
    </div>
  );
}
