import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { stockAnalysisInput } from './logistics';

export const analyzeStock = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => stockAnalysisInput.parse(input))
  .handler(async ({ data, context }) => {
    const permission = await context.supabase.rpc('has_any_role', { _user_id: context.userId, _roles: ['storekeeper'] });
    if (permission.error || !permission.data) throw new Error('Only inventory staff can analyze stock discrepancies.');
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { error: 'Lovable AI is not configured.', text: '', movementCount: 0, reconciliationCount: 0, auditCount: 0, truncated: false };
    const { runStockAnalysis } = await import('./stock-analysis.server');
    return runStockAnalysis(context.supabase, context.userId, data, key, getRequest());
  });