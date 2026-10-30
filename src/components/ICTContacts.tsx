import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { details } from '@/lib/hr';
import { exportExcel, exportPdf } from '@/lib/export';
import { OfficerPhoto } from '@/components/PassportPhoto';

/** Read-only staff contact directory for ICT support. */
export function ICTContacts() {
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['ict-contacts'],
    queryFn: async () => {
      const r = await supabase.from('officers').select('id,full_name,rank,service_number,form_number,phone,email,official_email,address,county,photo_url,enrollment_profile,archived_at,offices(name)').is('archived_at', null).order('full_name');
      if (r.error) throw r.error; return r.data;
    },
  });
  const rows = useMemo(() => data.map(o => { const p = details(o.enrollment_profile); return {
    o, Name: `${o.rank} ${o.full_name}`, 'LNP ID': o.service_number, Department: o.offices?.name ?? '', Mobile: o.phone ?? '', 'Work phone': p['work_phone'] ?? '', 'Alt. phone': p['alt_phone'] ?? '',
    'Personal email': o.email ?? '', 'Official email': o.official_email ?? '', Address: [o.address, p['city'], p['district'], o.county].filter(Boolean).join(', '),
    Emergency: [p['emergency_name'], p['emergency_relationship'] && `(${p['emergency_relationship']})`, p['emergency_phone']].filter(Boolean).join(' '),
  }; }).filter(r => !q || Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const plain = () => rows.map(({ o: _o, ...r }) => r);
  const cols = ['LNP ID', 'Department', 'Mobile', 'Work phone', 'Alt. phone', 'Personal email', 'Official email', 'Address', 'Emergency'] as const;
  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center"><Input placeholder="Search name, phone or email" aria-label="Search contacts" value={q} onChange={e => setQ(e.target.value)} className="w-64" /><span className="text-sm text-muted-foreground">{rows.length} staff</span>
      <div className="ml-auto flex gap-2"><Button size="sm" variant="outline" onClick={() => exportPdf('Staff contact directory', plain())}>PDF</Button><Button size="sm" variant="outline" onClick={() => exportExcel('staff-contacts', plain())}>Excel</Button></div></div>
    <div className="overflow-x-auto border rounded-md"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-2" /><th className="p-2 font-medium">Name</th>{cols.map(c => <th key={c} className="p-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead><tbody>
      {isLoading && <tr><td colSpan={11} className="p-4 text-muted-foreground">Loading…</td></tr>}
      {!isLoading && rows.length === 0 && <tr><td colSpan={11} className="p-4 text-muted-foreground">No staff match.</td></tr>}
      {rows.map(r => <tr key={r.o.id} className="border-t align-top"><td className="p-2"><OfficerPhoto path={r.o.photo_url} name={r.o.full_name} /></td><td className="p-2 font-medium whitespace-nowrap">{r.Name}</td>{cols.map(c => <td key={c} className="p-2 break-words max-w-[220px]">{r[c] || '—'}</td>)}</tr>)}
    </tbody></table></div>
  </section>;
}
