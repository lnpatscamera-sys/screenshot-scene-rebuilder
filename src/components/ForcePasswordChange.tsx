import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { passwordProblem } from '@/lib/enrollment';

/** Blocks the app until an HR-enrolled officer replaces the default password. */
export function ForcePasswordChange({ current }: { current?: string }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const problem = passwordProblem(v.password);
    if (problem) return toast.error(problem);
    if (v.password !== v.confirm) return toast.error('The passwords do not match.');
    if (v.password === v.current) return toast.error('Choose a password different from the default one.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: v.password, current_password: v.current, data: { must_change_password: false } } as never);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Password changed.');
  };
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="flex justify-center"><Logo className="h-16 w-16" /></div>
        <h1 className="text-2xl font-bold">Change your password</h1>
        <p className="text-sm text-muted-foreground">For your security, replace the default password before using LNPATS ERP.</p>
        <div className="space-y-1"><Label htmlFor="fp-current">Default password</Label><Input id="fp-current" name="current" type="password" required defaultValue={current} /></div>
        <div className="space-y-1"><Label htmlFor="fp-new">New password</Label><Input id="fp-new" name="password" type="password" required minLength={8} /></div>
        <div className="space-y-1"><Label htmlFor="fp-confirm">Confirm new password</Label><Input id="fp-confirm" name="confirm" type="password" required minLength={8} /></div>
        <Button className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button>
      </form>
    </div>
  );
}
