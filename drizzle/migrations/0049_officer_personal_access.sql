CREATE OR REPLACE FUNCTION public.officer_personal_only() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role<>'officer') $$;
REVOKE ALL ON FUNCTION public.officer_personal_only() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.officer_personal_only() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.officer_owns(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.officers WHERE id=_id AND user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.officer_owns(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.officer_owns(uuid) TO authenticated,service_role;
DO $$ DECLARE t record; scope text; write_scope text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
 scope:=CASE t.tablename
 WHEN 'officers' THEN 'user_id=auth.uid()'
 WHEN 'profiles' THEN 'id=auth.uid()'
 WHEN 'user_roles' THEN 'user_id=auth.uid()'
 WHEN 'daily_reports' THEN 'created_by=auth.uid()'
 WHEN 'supply_requests' THEN 'requested_by=auth.uid()'
 WHEN 'tickets' THEN '(created_by=auth.uid() OR public.officer_owns(reported_by))'
 WHEN 'notifications' THEN 'user_id=auth.uid()'
 WHEN 'erp_documents' THEN 'author_id=auth.uid()'
 WHEN 'officer_documents' THEN 'public.officer_owns(officer_id)'
 WHEN 'document_versions' THEN 'EXISTS(SELECT 1 FROM public.erp_documents d WHERE d.id=document_id AND d.author_id=auth.uid())'
 WHEN 'attendance' THEN 'public.officer_owns(officer_id)'
 WHEN 'attendance_punches' THEN 'public.officer_owns(officer_id)'
 WHEN 'training_records' THEN 'public.officer_owns(officer_id)'
 WHEN 'mail_accounts' THEN 'user_id=auth.uid()'
 WHEN 'cadets' THEN 'user_id=auth.uid()'
 WHEN 'program_enrollments' THEN 'EXISTS(SELECT 1 FROM public.cadets c WHERE c.id=cadet_id AND c.user_id=auth.uid())'
 WHEN 'attendance_records' THEN 'EXISTS(SELECT 1 FROM public.cadets c WHERE c.id=cadet_id AND c.user_id=auth.uid())'
 WHEN 'assessment_results' THEN 'EXISTS(SELECT 1 FROM public.cadets c WHERE c.id=cadet_id AND c.user_id=auth.uid())'
 WHEN 'graduations' THEN 'EXISTS(SELECT 1 FROM public.cadets c WHERE c.id=cadet_id AND c.user_id=auth.uid())'
 WHEN 'certificates' THEN 'EXISTS(SELECT 1 FROM public.cadets c WHERE c.id=cadet_id AND c.user_id=auth.uid())'
 WHEN 'sections' THEN 'EXISTS(SELECT 1 FROM public.officers o WHERE o.user_id=auth.uid() AND o.section_id=sections.id)'
 WHEN 'offices' THEN 'EXISTS(SELECT 1 FROM public.officers o WHERE o.user_id=auth.uid() AND o.office_id=offices.id)'
 ELSE 'false' END;
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 EXECUTE format('CREATE POLICY officer_personal_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.officer_personal_only() OR (%s))',t.tablename,scope);
 write_scope:=CASE WHEN t.tablename IN ('daily_reports','supply_requests','tickets','notifications','mail_accounts') THEN scope ELSE 'false' END;
 EXECUTE format('CREATE POLICY officer_personal_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.officer_personal_only() OR (%s))',t.tablename,write_scope);
 EXECUTE format('CREATE POLICY officer_personal_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.officer_personal_only() OR (%s)) WITH CHECK (NOT public.officer_personal_only() OR (%s))',t.tablename,write_scope,write_scope);
 EXECUTE format('CREATE POLICY officer_personal_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.officer_personal_only() OR (%s))',t.tablename,CASE WHEN t.tablename='mail_accounts' THEN scope ELSE 'false' END);
 END LOOP;
END $$;
GRANT SELECT ON public.attendance_punches, public.training_records, public.officer_documents TO authenticated;
CREATE POLICY officer_reads_own_punches ON public.attendance_punches FOR SELECT TO authenticated USING(public.officer_owns(officer_id));
CREATE POLICY officer_reads_own_training ON public.training_records FOR SELECT TO authenticated USING(public.officer_owns(officer_id));
CREATE POLICY officer_reads_own_documents ON public.officer_documents FOR SELECT TO authenticated USING(public.officer_owns(officer_id));
CREATE OR REPLACE FUNCTION public.command_directory() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 RETURN jsonb_build_object('officers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'full_name',o.full_name,'employee_number',o.employee_number,'user_id',o.user_id,'office_id',o.office_id,'section_id',o.section_id,'supervisor_id',o.supervisor_id,'employment_status',o.employment_status)) FROM officers o WHERE o.employment_status='Active' AND (NOT public.officer_personal_only() OR o.user_id=auth.uid())),'[]'::jsonb),'sections',CASE WHEN public.officer_personal_only() THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'office_id',s.office_id,'section_head',s.section_head)) FROM sections s),'[]'::jsonb) END,'offices',CASE WHEN public.officer_personal_only() THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM offices),'[]'::jsonb) END,'appointments',CASE WHEN public.officer_personal_only() THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM reporting_lines r),'[]'::jsonb) END);
 END $$;
CREATE OR REPLACE FUNCTION public.ict_directory() RETURNS TABLE(id uuid,full_name text,office_id uuid,section_id uuid,user_id uuid,is_technician boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT o.id,o.full_name,o.office_id,o.section_id,o.user_id,EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=o.user_id AND ur.role IN ('ict_admin','system_admin')) FROM officers o WHERE auth.uid() IS NOT NULL AND (NOT public.officer_personal_only() OR o.user_id=auth.uid()) $$;
DO $$ DECLARE d text; name text; BEGIN
 FOR name IN SELECT unnest(ARRAY['command_report_reader','command_supply_reader','can_read_document']) LOOP
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=name;
 IF name='command_report_reader' THEN d:=replace(d,'r.id=_id AND (','r.id=_id AND (NOT public.officer_personal_only() OR r.created_by=auth.uid()) AND (');
 ELSIF name='command_supply_reader' THEN d:=replace(d,'r.id=_id AND (','r.id=_id AND (NOT public.officer_personal_only() OR r.requested_by=auth.uid()) AND (');
 ELSE d:=replace(d,'d.id=_id AND (','d.id=_id AND (NOT public.officer_personal_only() OR d.author_id=auth.uid()) AND ('); END IF;
 EXECUTE d;
 END LOOP;
 FOR name IN SELECT unnest(ARRAY['command_chain','daily_report_action','command_supply_action','ict_action','command_report_summary','compile_daily_reports','facility_action','phase2_workflow','command_supply_evidence']) LOOP
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=name;
 IF name='command_chain' THEN d:=replace(d,'BEGIN','BEGIN IF public.officer_personal_only() AND NOT public.officer_owns(_officer) THEN RAISE EXCEPTION ''Access Denied''; END IF;');
 ELSIF name='daily_report_action' THEN d:=replace(d,'BEGIN','BEGIN IF public.officer_personal_only() AND _action NOT IN (''save'',''submit'') THEN RAISE EXCEPTION ''Access Denied''; END IF;');
 ELSIF name='command_supply_action' THEN d:=replace(d,'BEGIN','BEGIN IF public.officer_personal_only() AND _action NOT IN (''submit'',''resubmit'',''sign_pickup'') THEN RAISE EXCEPTION ''Access Denied''; END IF;');
 ELSIF name='ict_action' THEN d:=replace(d,'BEGIN','BEGIN IF public.officer_personal_only() AND _module<>''tickets'' THEN RAISE EXCEPTION ''Access Denied''; END IF;');
 ELSIF name='command_report_summary' THEN d:=replace(d,'AND (all_access OR','AND (NOT public.officer_personal_only() OR o.user_id=auth.uid()) AND (all_access OR');
 ELSE d:=replace(d,'BEGIN','BEGIN IF public.officer_personal_only() THEN RAISE EXCEPTION ''Access Denied''; END IF;'); END IF;
 EXECUTE d;
 END LOOP;
END $$;