DROP POLICY "read officers" ON public.officers;
CREATE POLICY "read officers" ON public.officers FOR SELECT TO authenticated USING(public.hr_reader(id) OR public.hr_head(id) OR public.has_any_role(auth.uid(),ARRAY['dc_academy','assistant_commissioner','dc_admin','deputy_commandant','storekeeper','finance_admin','finance_officer','procurement_officer','procurement_admin','registry_officer','ict_admin']::public.app_role[]));
CREATE POLICY hr_training_cadet_counts ON public.cadets FOR SELECT TO authenticated USING(public.hr_staff());
CREATE POLICY hr_instructor_counts ON public.instructors FOR SELECT TO authenticated USING(public.hr_staff());
CREATE POLICY hr_department_leave ON public.leave_requests FOR SELECT TO authenticated USING(workflow_kind='HR' AND public.hr_head(officer_id));
CREATE POLICY hr_supervisor_appraisal ON public.performance_appraisals FOR SELECT TO authenticated USING(public.hr_head(officer_id));
CREATE OR REPLACE FUNCTION public.hr_leave_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE final_stage integer; BEGIN
IF TG_OP='INSERT' AND NEW.workflow_kind='HR' THEN PERFORM public.hr_validate_files(NEW.attachments); IF extract(year from NEW.start_date)<>extract(year from NEW.end_date) THEN RAISE EXCEPTION 'Split leave spanning years into separate applications'; END IF; END IF;
IF TG_OP='UPDATE' AND NEW.workflow_kind IS DISTINCT FROM OLD.workflow_kind THEN RAISE EXCEPTION 'Leave workflow cannot change'; END IF;
RETURN NEW; END $$;
DROP TRIGGER hr_leave_guard ON public.leave_requests;
CREATE TRIGGER hr_leave_guard BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.hr_leave_guard();
CREATE OR REPLACE FUNCTION public.hr_protect_personnel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF current_user='authenticated' THEN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain personnel files; retire or terminate the employee instead'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.employee_number IS DISTINCT FROM OLD.employee_number) THEN RAISE EXCEPTION 'Personnel identity cannot be changed'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER hr_protect_personnel BEFORE UPDATE OR DELETE ON public.officers FOR EACH ROW EXECUTE FUNCTION public.hr_protect_personnel();