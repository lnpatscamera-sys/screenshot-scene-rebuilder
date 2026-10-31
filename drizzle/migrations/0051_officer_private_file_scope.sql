CREATE OR REPLACE FUNCTION public.officer_personal_file_reader(_bucket text,_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
 (_bucket='officer-files' AND (EXISTS(SELECT 1 FROM officers o WHERE o.user_id=auth.uid() AND o.photo_url=_path) OR EXISTS(SELECT 1 FROM officer_documents d WHERE d.bucket_id=_bucket AND d.file_url=_path AND officer_owns(d.officer_id))))
 OR (_bucket='hr-files' AND (EXISTS(SELECT 1 FROM officer_documents d WHERE d.bucket_id=_bucket AND d.file_url=_path AND officer_owns(d.officer_id)) OR EXISTS(SELECT 1 FROM training_records r CROSS JOIN LATERAL jsonb_array_elements(r.attachments) f WHERE officer_owns(r.officer_id) AND f->>'path'=_path)))
 OR (_bucket='phase2-files' AND EXISTS(SELECT 1 FROM document_versions v JOIN erp_documents d ON d.id=v.document_id WHERE d.author_id=auth.uid() AND v.file_path=_path))
 OR (_bucket='command-files' AND (EXISTS(SELECT 1 FROM daily_reports r CROSS JOIN LATERAL jsonb_array_elements(r.attachments) f WHERE r.created_by=auth.uid() AND f->>'path'=_path) OR EXISTS(SELECT 1 FROM supply_requests r CROSS JOIN LATERAL jsonb_array_elements(r.attachments) f WHERE r.requested_by=auth.uid() AND f->>'path'=_path)))
 ); $$;
REVOKE ALL ON FUNCTION public.officer_personal_file_reader(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_personal_file_reader(text,text) TO authenticated,service_role;
CREATE POLICY officer_personal_files ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.officer_personal_only() OR public.officer_personal_file_reader(bucket_id,name));
DO $$ DECLARE fn record; d text; anchor text; guard text; BEGIN
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('command_supply_action','ict_action') LOOP
 d:=pg_get_functiondef(fn.oid);
 IF fn.proname='command_supply_action' THEN
 anchor:='BEGIN IF public.officer_personal_only()';
 guard:='BEGIN IF public.officer_personal_only() AND _action<>''submit'' AND NOT EXISTS(SELECT 1 FROM public.supply_requests WHERE id=_id AND requested_by=auth.uid()) THEN RAISE EXCEPTION ''Access Denied''; END IF; IF public.officer_personal_only()';
 ELSE
 anchor:='BEGIN IF public.officer_personal_only()';
 guard:='BEGIN IF public.officer_personal_only() AND _action<>''create'' AND NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=_id AND (created_by=auth.uid() OR public.officer_owns(reported_by))) THEN RAISE EXCEPTION ''Access Denied''; END IF; IF public.officer_personal_only()';
 END IF;
 IF position(anchor in d)=0 THEN RAISE EXCEPTION 'Guard insertion point missing in %',fn.proname; END IF;
 EXECUTE replace(d,anchor,guard);
 END LOOP;
END $$;