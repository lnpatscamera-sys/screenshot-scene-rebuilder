import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, useAuth, type AppRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { grantableAppointmentRoles, rankSummary } from '@/lib/appointments';

const KEY = ['appointments'];
async function load() {
  const [u, p, o, r] = await Promise.all([
    supabase.from('establishment_units').select('id,name,sort_order').order('sort_order'),
    supabase.from('establishment_posts').select('id,unit_id,title,rank_allocation,authorized,sort_order').order('sort_order'),
    supabase.from('officers').select('id,full_name,rank,user_id,establishment_post_id').order('full_name'),
    supabase.from('appointment_requests').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  for (const x of [u, p, o, r]) if (x.error) throw x.error;
  return { units: u.data!, posts: p.data!, officers: o.data!, requests: r.data! };
}

export function Appointments({ mode }: { mode: 'hr' | 'command' }) {
  const { hasAny } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: KEY, queryFn: load });
  const [unit, setUnit] = useState('');
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [busy, setBusy] = useState(false);
  const isHR = hasAny(['hr_admin', 'hr_officer']);
  const isCommandant = hasAny(['commandant']);

  const filled = useMemo(() => { const m: Record<string, number> = {}; data?.officers.forEach(o => { if (o.establishment_post_id) m[o.establishment_post_id] = (m[o.establishment_post_id] ?? 0) + 1; }); return m; }, [data]);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading establishment…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? 'Unable to load'}</p>;

  const postById = (id: string) => data.posts.find(p => p.id === id);
  const unitName = (id?: string) => data.units.find(u => u.id === id)?.name ?? '';
  const officer = (id: string) => data.officers.find(o => o.id === id);
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) toast.error(error.message); else { toast.success(ok); qc.invalidateQueries({ queryKey: KEY }); }
  };
  const pending = data.requests.filter(r => r.status === 'pending');
  const totalAuth = data.posts.reduce((s, p) => s + p.authorized, 0);
  const totalFilled = Object.values(filled).reduce((s, n) => s + n, 0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    void run(() => supabase.rpc('submit_appointment', { _officer: String(f.get('officer')), _post: String(f.get('post')), _roles: roles, _justification: String(f.get('justification') ?? '') }), 'Sent to the Commandant for approval').then(() => { form.reset(); setRoles([]); });
  }

  const requestRow = (r: (typeof data.requests)[number]) => { const p = postById(r.post_id); const o = officer(r.officer_id); return (
    <div key={r.id} className="py-3 flex flex-wrap gap-3 justify-between items-start">
      <div className="min-w-0">
        <p className="font-medium">{o?.full_name ?? 'Officer'} <span className="text-muted-foreground text-sm">({o?.rank})</span></p>
        <p className="text-sm">{p?.title} · <span className="text-muted-foreground">{unitName(p?.unit_id)}</span></p>
        {r.roles.length > 0 && <p className="text-xs mt-1">System access: {r.roles.map(x => ROLE_LABELS[x as AppRole]).join(', ')}</p>}
        {r.justification && <p className="text-xs text-muted-foreground mt-1">{r.justification}</p>}
        {r.decision_note && <p className="text-xs mt-1">Commandant: {r.decision_note}</p>}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Badge variant={r.status === 'approved' ? 'default' : r.status === 'pending' ? 'secondary' : 'outline'}>{r.status}</Badge>
        {r.status === 'pending' && mode === 'command' && isCommandant && <>
          <Button size="sm" disabled={busy} onClick={() => run(() => supabase.rpc('decide_appointment', { _id: r.id, _approve: true, _note: '' }), 'Appointment approved')}>Approve</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { const note = window.prompt('Reason for rejection'); if (note !== null) void run(() => supabase.rpc('decide_appointment', { _id: r.id, _approve: false, _note: note }), 'Appointment rejected'); }}>Reject</Button>
        </>}
        {r.status === 'pending' && mode === 'hr' && isHR && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => supabase.rpc('cancel_appointment', { _id: r.id }), 'Cancelled')}>Cancel</Button>}
      </div>
    </div>); };

  return <section className="space-y-6">
    <div className="grid grid-cols-3 border-y divide-x py-3">
      {[['Authorized posts', totalAuth], ['Filled', totalFilled], ['Awaiting Commandant', pending.length]].map(([k, v]) => <div key={k} className="px-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-semibold">{v}</p></div>)}
    </div>

    {mode === 'hr' && isHR && <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
      <div><Label htmlFor="ap-officer">Officer</Label><select id="ap-officer" name="officer" required className="h-9 w-full border rounded-md px-2 bg-background"><option value="">Select officer</option>{data.officers.map(o => <option key={o.id} value={o.id}>{o.full_name} — {o.rank}{o.user_id ? '' : ' (no account)'}</option>)}</select></div>
      <div><Label htmlFor="ap-unit">Unit / section</Label><select id="ap-unit" value={unit} onChange={e => setUnit(e.target.value)} required className="h-9 w-full border rounded-md px-2 bg-background"><option value="">Select unit</option>{data.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div className="sm:col-span-2"><Label htmlFor="ap-post">Post</Label><select id="ap-post" name="post" required className="h-9 w-full border rounded-md px-2 bg-background"><option value="">Select post</option>{data.posts.filter(p => p.unit_id === unit).map(p => <option key={p.id} value={p.id}>{p.title} — {rankSummary(p.rank_allocation)} · {filled[p.id] ?? 0}/{p.authorized} filled</option>)}</select></div>
      <fieldset className="sm:col-span-2"><legend className="text-sm font-medium mb-2">Recommended system access (granted only after Commandant approval)</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{grantableAppointmentRoles().map(r => <label key={r} className="flex items-center gap-2 text-sm"><Checkbox checked={roles.includes(r)} onCheckedChange={c => setRoles(s => c ? [...s, r] : s.filter(x => x !== r))} />{ROLE_LABELS[r]}</label>)}</div>
      </fieldset>
      <div className="sm:col-span-2"><Label htmlFor="ap-just">Justification</Label><Textarea id="ap-just" name="justification" rows={2} /></div>
      <Button disabled={busy} className="sm:w-fit">Send to Commandant</Button>
    </form>}

    <div><h2 className="font-semibold text-lg">{mode === 'command' ? 'Appointments awaiting your approval' : 'Pending appointments'}</h2>
      <div className="divide-y">{pending.map(requestRow)}{!pending.length && <p className="text-sm text-muted-foreground py-3">Nothing pending.</p>}</div></div>
    <div><h2 className="font-semibold text-lg">Decided</h2><div className="divide-y">{data.requests.filter(r => r.status !== 'pending').slice(0, 30).map(requestRow)}{data.requests.every(r => r.status === 'pending') && <p className="text-sm text-muted-foreground py-3">No decisions yet.</p>}</div></div>

    {mode === 'hr' && <div><h2 className="font-semibold text-lg mb-2">Establishment (Microstructure)</h2>
      <div className="space-y-4">{data.units.map(u => <div key={u.id}><h3 className="font-medium text-sm">{u.name}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{data.posts.filter(p => p.unit_id === u.id).map(p => <tr key={p.id} className="border-b"><td className="py-1.5 pr-3">{p.title}</td><td className="pr-3 text-muted-foreground">{rankSummary(p.rank_allocation)}</td><td className="text-right whitespace-nowrap">{filled[p.id] ?? 0}/{p.authorized}</td></tr>)}</tbody></table></div></div>)}</div></div>}
  </section>;
}
