alter publication supabase_realtime add table public.supply_requests;
alter publication supabase_realtime add table public.leave_requests;
create policy "staff read officer files" on storage.objects for select to authenticated using (bucket_id='officer-files');
create policy "hr upload officer files" on storage.objects for insert to authenticated with check (bucket_id='officer-files' and public.has_any_role(auth.uid(), array['hr_officer','commandant']::public.app_role[]));