CREATE OR REPLACE FUNCTION public.hr_protect_personnel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF current_user='authenticated' THEN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain personnel files; retire or terminate the employee instead'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.employee_number IS DISTINCT FROM OLD.employee_number) THEN RAISE EXCEPTION 'Personnel identity cannot be changed'; END IF;
END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;