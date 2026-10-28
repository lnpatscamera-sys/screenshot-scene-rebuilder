import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { ENROLL_ROLES } from '@/lib/enrollment';
import { enrollStaff } from '@/lib/enrollment.functions';

const FIELDS = [
  { name: 'fullName', label: 'Full name', type: 'text' },
  { name: 'lnpId', label: 'LNP ID Number', type: 'text' },
  { name: 'phone', label: 'Contact number', type: 'tel' },
  { name: 'classNumber', label: 'LNP Class number', type: 'text' },
  { name: 'email', label: 'Email address', type: 'email' },
] as const;

export function StaffEnrollment() {
  const { roles } = useAuth();
  const enroll = useServerFn(enrollStaff);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ lnpId: string; email: string; emailed: boolean; password: string | null } | null>(null);
  if (!roles.some((r) => (ENROLL_ROLES as readonly string[]).includes(r))) return <p className="text-sm text-muted-foreground">Only Human Resources can enroll staff.</p>;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as { fullName: string; lnpId: string; phone: string; classNumber: string; email: string };
    setBusy(true);
    try {
      const r = await enroll({ data: { fullName: v.fullName, lnpId: v.lnpId, phone: v.phone, classNumber: v.classNumber, email: v.email } });
      setResult(r);
      form.reset();
      qc.invalidateQueries();
      toast.success(r.emailed ? 'Account opened and login details emailed.' : 'Account opened, but the email could not be sent.');
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  };

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Enroll staff account</h2>
        <p className="text-sm text-muted-foreground">The officer's LNP ID Number becomes their username. A default password is generated and emailed to them; they must change it at first sign-in.</p>
      </div>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.name} className={f.name === 'fullName' || f.name === 'email' ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
            <Label htmlFor={`en-${f.name}`}>{f.label}</Label>
            <Input id={`en-${f.name}`} name={f.name} type={f.type} required />
          </div>
        ))}
        <Button disabled={busy} className="sm:w-fit">{busy ? 'Opening account…' : 'Open account'}</Button>
      </form>
      {result && (
        <div className="border-l-4 border-gold pl-4 py-2 text-sm space-y-1">
          <p className="font-medium">Account opened for {result.lnpId}</p>
          {result.emailed ? <p>Login details were emailed to {result.email}.</p> : <>
            <p className="text-destructive">The email could not be sent. Give the officer this default password privately:</p>
            <p className="font-mono text-base">{result.password}</p>
          </>}
        </div>
      )}
    </section>
  );
}
