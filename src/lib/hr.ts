import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { FileRecord } from './phase2-data';
export type Employee = Database['public']['Tables']['officers']['Row'];
export const HR_LEAVE_TYPES = ['Annual','Sick','Compassionate','Study','Maternity','Paternity','Emergency'];
export const APPRAISAL_AREAS = ['discipline','productivity','leadership','teamwork','communication','professionalism','training_participation'];
export const RATINGS = ['Poor','Fair','Good','Very Good','Excellent'];
export function details(value: Json): Record<string,string> { if (!value || typeof value !== 'object' || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value)['map'](([k,v]) => [k,String(v ?? '')])); }
export function netSalary(d: Record<string,string>) { return Number(d['basic_salary'] || 0)+Number(d['allowances'] || 0)+Number(d['overtime'] || 0)-Number(d['deductions'] || 0); }
export function appraisalRating(d: Record<string,string>) { const scores=APPRAISAL_AREAS.map(k=>Number(d[k])); if(scores.some(n=>!Number.isInteger(n)||n<1||n>5)) return null; return RATINGS[Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)-1]; }
async function fetchHR(){
 const read = async <T,>(q: PromiseLike<{data:T | null;error:unknown}>) => {const r=await q;if(r.error)throw r.error;return r.data;};
 const [employees,documents,attendance,leave,balances,vacancies,applicants,appraisals,promotions,transfers,training,discipline,payroll,reports,offices,sections,cadets,instructors]=await Promise.all([
 read(supabase.from('officers').select('*').order('full_name')),read(supabase.from('officer_documents').select('*').order('upload_date',{ascending:false})),read(supabase.from('attendance').select('*').order('attendance_date',{ascending:false})),read(supabase.from('leave_requests').select('*').order('created_at',{ascending:false})),read(supabase.from('leave_balances').select('*')),
 read(supabase.from('recruitment_vacancies').select('*')),read(supabase.from('recruitment_applicants').select('*')),read(supabase.from('performance_appraisals').select('*')),read(supabase.from('promotions').select('*')),read(supabase.from('transfers').select('*')),read(supabase.from('training_records').select('*')),read(supabase.from('disciplinary_actions').select('*')),read(supabase.from('payroll_records').select('*')),read(supabase.from('hr_reports').select('*')),read(supabase.from('offices').select('id,name')),read(supabase.from('sections').select('id,name,office_id')),read(supabase.from('cadets').select('id,status')),read(supabase.from('instructors').select('id,officer_id'))]);
 return {employees:employees??[],documents:documents??[],attendance:attendance??[],leave:leave??[],balances:balances??[],vacancies:vacancies??[],applicants:applicants??[],appraisals:appraisals??[],promotions:promotions??[],transfers:transfers??[],training:training??[],discipline:discipline??[],payroll:payroll??[],reports:reports??[],offices:offices??[],sections:sections??[],cadets:cadets??[],instructors:instructors??[]};
}
export const hrOptions = queryOptions({queryKey:['hr'],queryFn:fetchHR});
export type HRData = Awaited<ReturnType<typeof fetchHR>>;
export async function refreshHR(qc:QueryClient){await Promise.all(['hr','officers','phase2'].map(key=>qc.invalidateQueries({queryKey:[key]})));}
export async function hrAction(module:string,id:string|null,action:string,payload:Json={}){ const {data,error}=await supabase.rpc('hr_action',{_module:module,_id:id ?? '00000000-0000-0000-0000-000000000000',_action:action,_payload:payload});if(error)throw error;return data; }
export async function uploadHR(file:File,userId:string):Promise<FileRecord>{ const path=`${userId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await supabase.storage.from('hr-files').upload(path,file);if(error)throw error;return {path,name:file.name}; }
export async function openHR(file:FileRecord,bucket='hr-files'){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(file.path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer');}