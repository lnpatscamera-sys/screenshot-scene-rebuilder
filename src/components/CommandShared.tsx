import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { fileRecords, historyRecords } from '@/lib/phase2-data';
import { openCommandFile, uploadCommandFile, refreshCommand, exportCommandWord } from '@/lib/command';
import { exportPdf } from '@/lib/export';
import type { Json } from '@/integrations/supabase/types';
export function CommandExports({ title, rows }: { title: string; rows: Record<string, unknown>[] }) { return <div className="flex flex-wrap gap-2 no-print"><Button variant="outline" onClick={() => exportPdf(title, rows)}>PDF</Button><Button variant="outline" onClick={() => exportCommandWord(title, rows)}>Word</Button><Button variant="outline" onClick={() => window.print()}>Print</Button></div>; }
export function CommandFiles({ files, onChange }: { files: Json; onChange?: (files: Json) => void }) {
  const { session } = useAuth(); const [uploading, setUploading] = useState(false);
  return <div className="space-y-2"><Label>Attachments</Label>{onChange && <Input type="file" aria-label="Attachments" disabled={uploading} onChange={async e => { const f = e.target.files?.[0]; if (!f || !session) return; setUploading(true); try { const uploaded = await uploadCommandFile(f, session.user.id); onChange([...fileRecords(files), uploaded]); } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed'); } finally { setUploading(false); } }} />}{fileRecords(files).map(f => <div key={f.path} className="flex items-center gap-2"><Button type="button" variant="link" onClick={() => openCommandFile(f.path).catch(e => toast.error(e.message))}>{f.name}</Button>{onChange && <Button type="button" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => onChange(fileRecords(files).filter(x => x.path !== f.path))}>×</Button>}</div>)}</div>;
}
export function CommandHistory({ value }: { value: Json }) { return <ol className="space-y-2 text-xs mt-3">{historyRecords(value).filter(h => h.action !== 'previous revision').map((h, i) => <li key={i} className="border-l-2 pl-3"><strong>{h.action}</strong> · {h.by} · {new Date(h.at).toLocaleString()}{h.note && <p>{h.note}</p>}</li>)}</ol>; }
export function useCommandMutation() { const qc = useQueryClient(); const [busy, setBusy] = useState(false); return { busy, run: async (fn: () => Promise<unknown>, done?: () => void) => { setBusy(true); try { await fn(); await refreshCommand(qc); toast.success('Record updated'); done?.(); } catch (e) { toast.error(e instanceof Error ? e.message : String((e as { message?: string }).message ?? 'Action failed')); } finally { setBusy(false); } } }; }