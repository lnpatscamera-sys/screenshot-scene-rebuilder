import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ReportActions, AttachedFiles, History } from './Phase2Shared';
import { fileRecords, uploadPhaseFile } from '@/lib/phase2-data';
import { formValues } from '@/lib/export';
import { refreshProcurement, type ProcurementData } from '@/lib/procurement';
import { useAuth } from '@/lib/auth';
import type { Json } from '@/integrations/supabase/types';

export type FormField = { name: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; value?: string | undefined; min?: number; max?: number; step?: string };
export const options = (values: string[]) => values.map(value => ({ value, label: value }));
export function FormFields({ fields }: { fields: FormField[] }) {
  return <>{fields.map(f => <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2 space-y-1' : 'min-w-0 space-y-1'}><Label htmlFor={f.name}>{f.label}</Label>{f.options ? <select id={f.name} name={f.name} defaultValue={f.value ?? ''} required={f.required} className="w-full h-9 rounded-md border bg-background px-2 text-sm"><option value="">Select…</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === 'textarea' ? <Textarea id={f.name} name={f.name} defaultValue={f.value ?? ''} required={f.required} /> : <Input id={f.name} name={f.name} type={f.type ?? 'text'} defaultValue={f.value ?? ''} required={f.required} min={f.min} max={f.max} step={f.step ?? (f.type === 'number' ? '0.01' : undefined)} />}</div>)}</>;
}
export function useProcurementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (run: () => Promise<void>) => run(), onSuccess: async () => { toast.success('Saved'); await refreshProcurement(qc); }, onError: (e) => toast.error(e.message) });
}
export function RecordForm({ title, fields, onSave, onClose, extra, attachments = false }: { title: string; fields: FormField[]; onSave: (values: Record<string,string>, files: Json) => Promise<void>; onClose: () => void; extra?: ReactNode; attachments?: boolean }) {
  const { session } = useAuth(); const mutation = useProcurementMutation();
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const values = formValues(form); const input = form.elements.namedItem('files');
    const selected = input instanceof HTMLInputElement ? Array.from(input.files ?? []) : [];
    mutation.mutate(async () => {
      if (!session) throw new Error('Please sign in again.');
      const files = await Promise.all(selected.map(file => uploadPhaseFile(file, session.user.id)));
      await onSave(values, files); onClose();
    });
  };
  return <Dialog open onOpenChange={open => !open && !mutation.isPending && onClose()}><DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><form onSubmit={save} className="grid sm:grid-cols-2 gap-3"><FormFields fields={fields} />{extra}{attachments && <div className="sm:col-span-2 space-y-1"><Label htmlFor="files">Supporting documents</Label><Input id="files" name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" /></div>}<Button className="sm:col-span-2" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Saving…' : 'Save'}</Button></form></DialogContent></Dialog>;
}
export function RecordsTable<T extends { id: string | number }>({ title, rows, columns, report, onNew, onEdit, onView, actions }: { title: string; rows: T[]; columns: { label: string; render: (row: T) => ReactNode }[]; report: (row: T) => Record<string,unknown>; onNew?: (() => void) | undefined; onEdit?: ((row: T) => void) | undefined; onView?: ((row: T) => void) | undefined; actions?: (row: T) => ReactNode }) {
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><div className="flex flex-wrap gap-2"><ReportActions title={title} rows={rows.map(report)} />{onNew && <Button onClick={onNew}><Plus className="h-4 w-4" />New {title === 'Vendors' ? 'vendor' : title === 'Purchase requests' ? 'request' : title === 'Purchase orders' ? 'order' : title === 'Goods received notes' ? 'receipt' : title === 'Contracts' ? 'contract' : 'rating'}</Button>}</div></div><div className="overflow-x-auto border rounded-md"><Table><TableHeader><TableRow>{columns.map(c => <TableHead key={c.label}>{c.label}</TableHead>)}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{!rows.length && <TableRow><TableCell colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">No records found.</TableCell></TableRow>}{rows.map(row => <TableRow key={row.id}>{columns.map(c => <TableCell key={c.label}>{c.render(row)}</TableCell>)}<TableCell><div className="flex gap-1 justify-end flex-wrap">{actions?.(row)}{onEdit && <Button variant="ghost" size="icon" aria-label={`Edit ${title}`} title="Edit" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button>}{onView && <Button variant="ghost" size="icon" aria-label={`View ${title}`} title="View details" onClick={() => onView(row)}><Eye className="h-4 w-4" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table></div></div>;
}
export function RecordDetails({ title, module, record, d, children, onClose }: { title: string; module: string; record: { id: string; history?: Json | null; attachments?: Json | null }; d: ProcurementData; children?: ReactNode; onClose: () => void }) {
  const approvals = d.approvals.filter(a => a.module === module && a.record_id === record.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}{record.attachments && <section className="border-t pt-3"><h3 className="font-medium mb-2">Attachments</h3><AttachedFiles files={fileRecords(record.attachments)} module={module} id={record.id} /></section>}<section className="border-t pt-3"><h3 className="font-medium mb-2">Approval history</h3>{approvals.length ? <div className="space-y-3">{approvals.map(a => <div className="border-l-2 border-gold pl-3 text-sm" key={a.id}><div className="font-medium capitalize">{a.action} · {a.level}</div><div className="text-muted-foreground text-xs">{a.actor_name} · {new Date(a.created_at).toLocaleString()}</div>{a.signature && <div className="italic text-xs">Signed: {a.signature}</div>}{a.note && <p>{a.note}</p>}</div>)}</div> : <History value={record.history ?? []} />}</section></DialogContent></Dialog>;
}
export function useDecision() {
  const mutation = useProcurementMutation();
  const [decision, setDecision] = useState<{ title: string; date?: boolean; required: boolean; run: (note: string, date: string) => Promise<void> } | null>(null);
  return { busy: mutation.isPending, decide: setDecision, dialog: decision && <RecordForm title={decision.title} fields={[{ name: 'note', label: decision.required ? 'Reason' : 'Comment', type: 'textarea', required: decision.required }, ...(decision.date ? [{ name: 'date', label: 'New end date', type: 'date', required: true }] : [])]} onClose={() => setDecision(null)} onSave={async v => { await decision.run(v['note'] ?? '', v['date'] ?? ''); }} /> };
}
export function SearchFilters({ search, onSearch, status, onStatus, statuses }: { search: string; onSearch: (q: string) => void; status: string; onStatus: (s: string) => void; statuses: string[] }) {
  return <div className="flex flex-wrap gap-2 mb-4 no-print"><Input aria-label="Search procurement records" placeholder="Search records…" value={search} onChange={e => onSearch(e.target.value)} className="max-w-xs" /><select aria-label="Filter status" value={status} onChange={e => onStatus(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>;
}