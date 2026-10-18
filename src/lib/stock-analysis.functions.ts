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

export const resumeStockAnalysis = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const permission = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'system_admin' });
    if (permission.error || !permission.data) throw new Error('Only system administrators can restore AI access.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const state = await supabaseAdmin.from('stock_analysis_access').select('status_code').eq('id', 'stock-discrepancy').maybeSingle();
    if (state.error) throw new Error('AI access could not be checked.');
    if (state.data?.status_code === 403) throw new Error('Access must be restored by the provider or workspace administrator before this pause can be cleared.');
    const result = await supabaseAdmin.from('stock_analysis_access').upsert({ id: 'stock-discrepancy', blocked: false, reason: null, status_code: null, updated_at: new Date().toISOString() });
    if (result.error) throw new Error('AI access could not be restored.');
    return { success: true };
  });