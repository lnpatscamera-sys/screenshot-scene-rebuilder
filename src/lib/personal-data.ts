import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function personalOptions(userId: string) {
 return queryOptions({ queryKey: ['personal', userId], queryFn: async () => {
  const p = await supabase.from('officers').select('*').eq('user_id', userId).maybeSingle();
  if(p.error) throw p.error;
  const officerId = p.data?.id ?? '00000000-0000-0000-0000-000000000000';
  const [reports, supplies, tickets, notifications, documents, attendance, punches, training] = await Promise.all([
   supabase.from('daily_reports').select('*').eq('created_by',userId).order('report_date',{ascending:false}),
   supabase.from('supply_requests').select('*').eq('requested_by',userId).order('created_at',{ascending:false}),
   supabase.from('tickets').select('*').or(`created_by.eq.${userId},reported_by.eq.${officerId}`).order('created_at',{ascending:false}),
   supabase.from('notifications').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
   supabase.from('erp_documents').select('*').eq('author_id',userId).order('created_at',{ascending:false}),
   supabase.from('attendance').select('*').eq('officer_id',officerId).order('attendance_date',{ascending:false}),
   supabase.from('attendance_punches').select('id,punched_at,direction,method').eq('officer_id',officerId).order('punched_at',{ascending:false}),
   supabase.from('training_records').select('*').eq('officer_id',officerId),
  ]);
  for(const result of [reports,supplies,tickets,notifications,documents,attendance,punches,training]) if(result.error) throw result.error;
  return { profile:p.data, reports:reports.data??[], supplies:supplies.data??[], tickets:tickets.data??[], notifications:notifications.data??[], documents:documents.data??[], attendance:attendance.data??[], punches:punches.data??[], training:training.data??[] };
 }});
}
