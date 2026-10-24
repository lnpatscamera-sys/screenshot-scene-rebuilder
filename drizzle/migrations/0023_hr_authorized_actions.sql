CREATE OR REPLACE FUNCTION public.hr_action(_module text,_id uuid,_action text,_payload jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tbl text; r record; emp officers; oid uuid; rid uuid; h jsonb; d jsonb; new_status text; k text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 h:=jsonb_build_object('action',_action,'by',(SELECT email FROM profiles WHERE id=auth.uid()),'at',now(),'note',_payload->>'note');
 IF _module='employees' THEN
 IF NOT public.hr_staff() THEN RAISE EXCEPTION 'HR permission required'; END IF;
 IF _action IN ('suspend','retire','terminate') THEN
 IF nullif(trim(_payload->>'note'),'') IS NULL THEN RAISE EXCEPTION 'Reason required'; END IF;
 UPDATE officers SET employment_status=CASE _action WHEN 'suspend' THEN 'Suspended' WHEN 'retire' THEN 'Retired' ELSE 'Terminated' END,updated_at=now() WHERE id=_id; IF NOT FOUND THEN RAISE EXCEPTION 'Employee unavailable'; END IF; RETURN _id;
 ELSE RAISE EXCEPTION 'Invalid employee action'; END IF;
 ELSIF _module='attendance' THEN
 oid:=nullif(_payload->>'officer_id','')::uuid;
 IF _action IN ('check_in','check_out') THEN
 IF NOT public.hr_owner(oid) THEN RAISE EXCEPTION 'Only your own attendance may be recorded'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(oid::text||current_date::text));
 SELECT * INTO r FROM attendance WHERE officer_id=oid AND attendance_date=current_date ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF _action='check_in' THEN
 IF FOUND THEN RAISE EXCEPTION 'Attendance already recorded for today'; END IF;
 INSERT INTO attendance(officer_id,attendance_date,status,check_in,method,recorded_by) VALUES(oid,current_date,'Present',now(),CASE WHEN _payload->>'method'='QR' THEN 'QR' ELSE 'Self' END,auth.uid()) RETURNING id INTO rid;
 ELSE
 IF NOT FOUND OR r.check_in IS NULL OR r.check_out IS NOT NULL THEN RAISE EXCEPTION 'An open check-in is required'; END IF;
 UPDATE attendance SET check_out=now() WHERE id=r.id; rid:=r.id;
 END IF; RETURN rid;
 END IF;
 IF NOT (public.hr_staff() OR public.hr_head(oid)) THEN RAISE EXCEPTION 'Attendance permission required'; END IF;
 IF _payload->>'status' NOT IN ('Present','Absent','Late','Excused') THEN RAISE EXCEPTION 'Invalid attendance status'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(oid::text||(_payload->>'attendance_date')));
 IF _action='create' AND EXISTS(SELECT 1 FROM attendance WHERE officer_id=oid AND attendance_date=(_payload->>'attendance_date')::date) THEN RAISE EXCEPTION 'Attendance already recorded'; END IF;
 IF _action='create' THEN INSERT INTO attendance(officer_id,attendance_date,status,remarks,method,recorded_by) VALUES(oid,(_payload->>'attendance_date')::date,_payload->>'status',_payload->>'remarks','Manual',auth.uid()) RETURNING id INTO rid;
 ELSIF _action='edit' THEN UPDATE attendance SET status=_payload->>'status',remarks=_payload->>'remarks' WHERE id=_id AND officer_id=oid RETURNING id INTO rid;
 ELSE RAISE EXCEPTION 'Invalid attendance action'; END IF; RETURN rid;
 ELSIF _module='leave' AND _action='recall' THEN
 IF NOT public.hr_staff() OR nullif(trim(_payload->>'note'),'') IS NULL THEN RAISE EXCEPTION 'HR permission and recall reason required'; END IF;
 SELECT * INTO r FROM leave_requests WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'Approved' OR r.recalled_at IS NOT NULL THEN RAISE EXCEPTION 'Only approved, unrecalled leave may be recalled'; END IF;
 UPDATE leave_requests SET recalled_at=now(),recall_reason=_payload->>'note',history=history||h WHERE id=_id;
 RETURN _id;
 END IF;
 tbl:=CASE _module WHEN 'vacancies' THEN 'recruitment_vacancies' WHEN 'applicants' THEN 'recruitment_applicants' WHEN 'appraisals' THEN 'performance_appraisals' WHEN 'promotions' THEN 'promotions' WHEN 'transfers' THEN 'transfers' WHEN 'training' THEN 'training_records' WHEN 'discipline' THEN 'disciplinary_actions' WHEN 'payroll' THEN 'payroll_records' WHEN 'reports' THEN 'hr_reports' END;
 IF tbl IS NULL THEN RAISE EXCEPTION 'Invalid HR module'; END IF;
 IF _action IN ('create','edit') THEN
 oid:=nullif(_payload->>'officer_id','')::uuid; d:=coalesce(_payload->'details','{}');
 IF NOT public.hr_staff() AND NOT (_module='appraisals' AND ((public.hr_owner(oid) AND d->>'assessment_type'='Self') OR (public.hr_head(oid) AND d->>'assessment_type'='Supervisor'))) THEN RAISE EXCEPTION 'HR permission required'; END IF;
 IF _module='appraisals' THEN
 FOREACH k IN ARRAY ARRAY['discipline','productivity','leadership','teamwork','communication','professionalism','training_participation'] LOOP IF coalesce((d->>k)::integer,0) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Appraisal scores must be 1 to 5'; END IF; END LOOP;
 END IF;
 IF _module='payroll' AND (coalesce((d->>'basic_salary')::numeric,0)<0 OR coalesce((d->>'allowances')::numeric,0)<0 OR coalesce((d->>'deductions')::numeric,0)<0 OR coalesce((d->>'overtime')::numeric,0)<0) THEN RAISE EXCEPTION 'Payroll amounts cannot be negative'; END IF;
 IF _module='vacancies' AND ((d->>'number_required')::integer<1 OR (d->>'closing_date')::date<(d->>'posting_date')::date) THEN RAISE EXCEPTION 'Invalid vacancy dates or count'; END IF;
 IF _module='applicants' AND NOT EXISTS(SELECT 1 FROM recruitment_vacancies WHERE id=(d->>'vacancy_id')::uuid AND status='Published' AND (details->>'closing_date')::date>=current_date) THEN RAISE EXCEPTION 'Published, open vacancy required'; END IF;
 IF _module NOT IN ('vacancies','applicants','reports') AND oid IS NULL THEN RAISE EXCEPTION 'Employee required'; END IF;
 PERFORM public.hr_validate_files(coalesce(_payload->'attachments','[]'));
 IF _action='create' THEN
 IF _module='promotions' THEN SELECT * INTO emp FROM officers WHERE id=oid; INSERT INTO promotions(officer_id,previous_rank,promoted_rank,promotion_date,remarks,status,details,history) VALUES(oid,emp.rank,d->>'new_rank',(d->>'effective_date')::date,d->>'recommendation','Pending',d,jsonb_build_array(h)) RETURNING id INTO rid;
 ELSIF _module='discipline' THEN INSERT INTO disciplinary_actions(officer_id,incident_date,offense,action_taken,case_number,status,details,attachments,history) VALUES(oid,(d->>'incident_date')::date,d->>'description',d->>'sanctions','LNPATS-CASE-'||substring(gen_random_uuid()::text,1,8),'Open',d,coalesce(_payload->'attachments','[]'),jsonb_build_array(h)) RETURNING id INTO rid;
 ELSE EXECUTE format('INSERT INTO public.%I(officer_id,status,details,attachments,history,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',tbl) INTO rid USING oid,CASE WHEN _module IN ('transfers','appraisals') THEN 'Pending' ELSE 'Draft' END,d,coalesce(_payload->'attachments','[]'),jsonb_build_array(h),auth.uid(); END IF;
 ELSE
 EXECUTE format('SELECT * FROM public.%I WHERE id=$1 FOR UPDATE',tbl) INTO r USING _id;
 IF r.id IS NULL OR r.officer_id IS DISTINCT FROM oid THEN RAISE EXCEPTION 'Record unavailable'; END IF;
 IF NOT public.hr_staff() AND NOT (r.created_by=auth.uid() AND r.status='Pending') THEN RAISE EXCEPTION 'Own assessment required'; END IF;
 IF _module IN ('promotions','transfers','appraisals') AND r.status NOT IN ('Pending','Draft') THEN RAISE EXCEPTION 'Decided records cannot be changed'; END IF;
 IF _module='promotions' THEN UPDATE promotions SET promoted_rank=d->>'new_rank',promotion_date=(d->>'effective_date')::date,remarks=d->>'recommendation',details=d,history=history||h WHERE id=_id;
 ELSIF _module='discipline' THEN IF r.status='Closed' THEN RAISE EXCEPTION 'Case closed'; END IF; UPDATE disciplinary_actions SET incident_date=(d->>'incident_date')::date,offense=d->>'description',action_taken=d->>'sanctions',details=d,attachments=attachments||coalesce(_payload->'attachments','[]'),history=history||h WHERE id=_id;
 ELSE EXECUTE format('UPDATE public.%I SET details=$1,attachments=attachments||$2,history=history||$3 WHERE id=$4',tbl) USING d,coalesce(_payload->'attachments','[]'),h,_id; END IF; rid:=_id;
 END IF; RETURN rid;
 END IF;
 EXECUTE format('SELECT * FROM public.%I WHERE id=$1 FOR UPDATE',tbl) INTO r USING _id;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Record unavailable'; END IF;
 IF _module IN ('promotions','transfers') THEN
 IF NOT public.has_any_role(auth.uid(),ARRAY['commandant','hr_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Approval authority required'; END IF;
 IF r.status<>'Pending' OR _action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF _action='reject' AND nullif(trim(_payload->>'note'),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
 new_status:=CASE WHEN _action='approve' THEN 'Approved' ELSE 'Rejected' END;
 IF _action='approve' THEN
 SELECT * INTO emp FROM officers WHERE id=r.officer_id FOR UPDATE;
 IF _module='promotions' THEN
 IF emp.rank IS DISTINCT FROM r.previous_rank THEN RAISE EXCEPTION 'Current rank changed; submit a new recommendation'; END IF;
 IF r.promotion_date>current_date THEN RAISE EXCEPTION 'Effective date has not arrived'; END IF;
 UPDATE officers SET rank=r.promoted_rank,updated_at=now() WHERE id=r.officer_id;
 ELSE
 IF (r.details->>'effective_date')::date>current_date THEN RAISE EXCEPTION 'Effective date has not arrived'; END IF;
 UPDATE officers SET office_id=nullif(r.details->>'office_id','')::uuid,section_id=nullif(r.details->>'section_id','')::uuid,updated_at=now() WHERE id=r.officer_id;
 END IF; END IF;
 ELSE
 IF NOT public.hr_staff() THEN RAISE EXCEPTION 'HR permission required'; END IF;
 new_status:=CASE WHEN _module='vacancies' AND _action='publish' AND r.status='Draft' THEN 'Published' WHEN _module='vacancies' AND _action='close' AND r.status='Published' THEN 'Closed'
 WHEN _module='applicants' AND _action='shortlist' AND r.status='Draft' THEN 'Shortlisted' WHEN _module='applicants' AND _action='interview' AND r.status='Shortlisted' THEN 'Interview Scheduled' WHEN _module='applicants' AND _action='select' AND r.status='Interview Scheduled' THEN 'Selected' WHEN _module='applicants' AND _action='appoint' AND r.status='Selected' THEN 'Appointed' WHEN _module='applicants' AND _action='reject' AND r.status<>'Appointed' THEN 'Rejected'
 WHEN _module='discipline' AND _action='close' AND r.status='Open' THEN 'Closed' WHEN _module='appraisals' AND _action='finalize' AND r.status='Pending' THEN 'Final' ELSE NULL END;
 IF new_status IS NULL THEN RAISE EXCEPTION 'Action unavailable'; END IF;
 IF _action='interview' AND nullif(_payload->>'interview_at','') IS NULL THEN RAISE EXCEPTION 'Interview time required'; END IF;
 IF _module='discipline' AND _action='close' AND nullif(r.details->>'findings','') IS NULL THEN RAISE EXCEPTION 'Findings required before closing'; END IF;
 END IF;
 EXECUTE format('UPDATE public.%I SET status=$1,details=details||$2,history=history||$3 WHERE id=$4',tbl) USING new_status,_payload-'attachments',h,_id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.hr_action(text,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_action(text,uuid,text,jsonb) TO authenticated;
DO $$ DECLARE src text; BEGIN
SELECT pg_get_functiondef('public.act_on_leave(uuid,boolean,text)'::regprocedure) INTO src;
src:=replace(src,'n integer; b public.leave_balances;','n integer; b public.leave_balances; terminal integer;');
src:=replace(src,'IF NOT (public.has_any_role(auth.uid(),public.leave_stage_role(r.stage)) OR public.phase2_admin()) THEN', 'terminal:=CASE WHEN r.workflow_kind=''HR'' THEN 2 ELSE 5 END; IF NOT (CASE WHEN r.workflow_kind=''HR'' THEN (CASE WHEN r.stage=1 THEN public.hr_head(r.officer_id) OR EXISTS(SELECT 1 FROM officers o JOIN officers supervisor ON supervisor.id=o.supervisor_id WHERE o.id=r.officer_id AND supervisor.user_id=auth.uid()) WHEN r.stage=2 THEN public.hr_staff() ELSE false END) ELSE public.has_any_role(auth.uid(),public.leave_stage_role(r.stage)) END OR public.phase2_admin()) THEN');
src:=replace(src,'r.stage=5','r.stage=terminal'); src:=replace(src,'r.stage<5','r.stage<terminal');
EXECUTE src;
END $$;
CREATE OR REPLACE FUNCTION public.hr_leave_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NEW.workflow_kind='HR' THEN PERFORM public.hr_validate_files(NEW.attachments); IF extract(year from NEW.start_date)<>extract(year from NEW.end_date) THEN RAISE EXCEPTION 'Split leave spanning years into separate applications'; END IF; END IF;
RETURN NEW; END $$;
CREATE TRIGGER hr_leave_guard BEFORE INSERT ON leave_requests FOR EACH ROW EXECUTE FUNCTION public.hr_leave_guard();