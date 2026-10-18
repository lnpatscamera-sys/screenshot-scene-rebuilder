import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Search as ClipboardSearch, LoaderCircle } from 'lucide-react';
import { analyzeStock } from '@/lib/stock-analysis.functions';
import { useAuth } from '@/lib/auth';
import { canAnalyzeStock } from '@/lib/logistics';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function StockAnalysis({ items }: { items: { id: string; code: string; name: string }[] }) {
  const { roles } = useAuth();
  const analyze = useServerFn(analyzeStock);
  const [itemId, setItemId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzeStock>> | null>(null);
  if (!canAnalyzeStock(roles)) return null;
  return <section className="mt-8 border-t pt-6 space-y-4">
    <h2 className="text-lg font-semibold flex gap-2 items-center"><ClipboardSearch className="h-5 w-5 text-primary" />Stock discrepancy analysis</h2>
    <form className="space-y-4 max-w-2xl" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setResult(null); try { setResult(await analyze({ data: { itemId, description } })); } catch (error) { setResult({ text: '', error: error instanceof Error ? error.message : 'Analysis failed.', movementCount: 0, reconciliationCount: 0, auditCount: 0, truncated: false }); } finally { setBusy(false); } }}>
      <div className="space-y-1"><Label htmlFor="analysis-item">Inventory item</Label><select id="analysis-item" required value={itemId} disabled={busy} onChange={e => { setItemId(e.target.value); setResult(null); }} className="w-full h-10 rounded-md border bg-background px-3 text-sm"><option value="">Select item…</option>{items.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="discrepancy-description">Discrepancy observed</Label><Textarea id="discrepancy-description" required minLength={10} maxLength={4000} rows={4} disabled={busy} value={description} onChange={e => setDescription(e.target.value)} placeholder="The physical count is lower than the recorded balance…" /></div>
      <Button disabled={busy || !itemId || description.trim().length < 10}><ClipboardSearch className="h-4 w-4" />{busy ? 'Reviewing stock evidence…' : 'Analyze discrepancy'}</Button>
    </form>
    {busy && <p role="status" className="text-sm text-muted-foreground flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Reviewing movements, reconciliations and audit entries…</p>}
    {result?.error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{result.error}</p>}
    {result?.text && <div className="border-l-2 border-primary pl-4 space-y-3"><p className="text-xs text-muted-foreground">{result.movementCount} movements · {result.reconciliationCount} reconciliations · {result.auditCount} audit entries{result.truncated ? ' · Recent evidence only' : ''}</p><div className="text-sm break-words leading-relaxed space-y-3"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ h2: props => <h3 className="text-lg font-semibold pt-3" {...props} />, table: props => <div className="overflow-x-auto"><table className="w-full border-collapse text-sm" {...props} /></div>, th: props => <th className="border-b text-left p-2" {...props} />, td: props => <td className="border-b p-2 align-top" {...props} />, ul: props => <ul className="list-disc pl-5 space-y-2" {...props} />, ol: props => <ol className="list-decimal pl-5 space-y-2" {...props} /> }}>{result.text}</ReactMarkdown></div><p className="text-xs text-muted-foreground">Advisory findings · Staff verification required · No stock changes made</p></div>}
  </section>;
}