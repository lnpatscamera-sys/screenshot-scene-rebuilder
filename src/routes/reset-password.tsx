import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { passwordProblem } from "@/lib/enrollment";
import { completePasswordReset } from "@/lib/enrollment.functions";

const TOKEN_KEY = "lnpats-recovery-token";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — LNPATS ERP" },
      { name: "description", content: "Set a new password for your LNPATS ERP account." },
      { property: "og:title", content: "Reset password — LNPATS ERP" },
      { property: "og:description", content: "Set a new password for your LNPATS ERP account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true); });
    try { if (sessionStorage.getItem(TOKEN_KEY)) setReady(true); } catch { /* ignore */ }
    supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as { password: string; confirm: string };
    const problem = passwordProblem(v.password);
    if (problem) { toast.error(problem); return; }
    if (v.password !== v.confirm) { toast.error("The passwords do not match."); return; }
    setBusy(true);
    let token: string | null = null;
    try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
    if (!token) token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
    if (!token) { setBusy(false); toast.error('This reset link has expired. Choose "Forgot password?" again.'); return; }
    try {
      await completePasswordReset({ data: { accessToken: token, password: v.password } });
    } catch (err) { setBusy(false); toast.error(err instanceof Error ? err.message : "Could not change the password."); return; }
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setBusy(false);
    toast.success("Password changed. Sign in with your new password.");
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="flex justify-center"><Logo className="h-16 w-16" /></div>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email. If the link has expired, go back to sign in and choose "Forgot password?" again.</p>
        ) : (
          <>
            <div className="space-y-1"><Label htmlFor="rp-new">New password</Label><Input id="rp-new" name="password" type="password" required minLength={8} /></div>
            <div className="space-y-1"><Label htmlFor="rp-confirm">Confirm new password</Label><Input id="rp-confirm" name="confirm" type="password" required minLength={8} /></div>
            <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
          </>
        )}
        <Button type="button" variant="ghost" className="w-full" onClick={() => nav({ to: "/auth" })}>Back to sign in</Button>
      </form>
    </div>
  );
}
