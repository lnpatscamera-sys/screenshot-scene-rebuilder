CREATE OR REPLACE FUNCTION public.hr_personnel_derive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.form_number IS NULL THEN NEW.form_number := next_hr_form_number();
  ELSE NEW.form_number := OLD.form_number; END IF;
  NEW.retirement_date := CASE WHEN NEW.date_of_birth IS NULL THEN NULL ELSE (NEW.date_of_birth + interval '65 years')::date END;
  IF TG_OP='UPDATE' AND OLD.official_email IS NOT NULL THEN NEW.official_email := OLD.official_email;
  ELSE NEW.official_email := official_email_for(NEW.first_name, NEW.last_name, regexp_replace(NEW.full_name,'^(Supt|Insp|Sgt|Cpl|CIP|CSP|ACP|DCP|Comm|DIGP)\.?\s+','','i'), NEW.id); END IF;
  RETURN NEW;
END $$;
DELETE FROM public.hr_form_counters WHERE year IS NOT NULL;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.officers WHERE form_number IS NULL ORDER BY created_at, id LOOP
    UPDATE public.officers SET form_number = NULL WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.officers DISABLE TRIGGER hr_personnel_derive;
UPDATE public.officers SET official_email = 'p.cole@lnpats.net' WHERE official_email = 's.cole@lnpats.net' AND full_name ILIKE '%Prince%Cole%';
ALTER TABLE public.officers ENABLE TRIGGER hr_personnel_derive;