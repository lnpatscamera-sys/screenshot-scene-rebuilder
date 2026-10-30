ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS form_number text, ADD COLUMN IF NOT EXISTS official_email text;
CREATE UNIQUE INDEX IF NOT EXISTS officers_form_number_key ON public.officers(form_number);
CREATE UNIQUE INDEX IF NOT EXISTS officers_official_email_key ON public.officers(lower(official_email));

CREATE TABLE IF NOT EXISTS public.hr_form_counters(year int PRIMARY KEY, last_value int NOT NULL DEFAULT 0);
GRANT ALL ON public.hr_form_counters TO service_role;
ALTER TABLE public.hr_form_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_hr_form_number() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE y int := extract(year from (now() AT TIME ZONE 'Africa/Monrovia'))::int; n int;
BEGIN
  INSERT INTO hr_form_counters(year,last_value) VALUES (y,1) ON CONFLICT (year) DO UPDATE SET last_value=hr_form_counters.last_value+1 RETURNING last_value INTO n;
  RETURN 'HR-'||y||'-'||lpad(n::text,5,'0');
END $$;
REVOKE ALL ON FUNCTION public.next_hr_form_number() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_email_for(_first text, _last text, _full text, _self uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; l text; parts text[]; base text; cand text; i int := 1;
BEGIN
  f := lower(regexp_replace(coalesce(nullif(trim(_first),''), split_part(trim(_full),' ',1)),'[^A-Za-z]','','g'));
  IF nullif(trim(_last),'') IS NOT NULL THEN l := _last; ELSE parts := regexp_split_to_array(trim(coalesce(_full,'')),'\s+'); l := parts[array_length(parts,1)]; END IF;
  l := lower(regexp_replace(coalesce(l,''),'[^A-Za-z]','','g'));
  IF f = '' OR l = '' THEN RETURN NULL; END IF;
  base := left(f,1)||'.'||l; cand := base;
  WHILE EXISTS (SELECT 1 FROM officers WHERE lower(official_email)=cand||'@lnpats.net' AND id IS DISTINCT FROM _self) LOOP i := i+1; cand := base||i; END LOOP;
  RETURN cand||'@lnpats.net';
END $$;
REVOKE ALL ON FUNCTION public.official_email_for(text,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hr_personnel_derive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.form_number := next_hr_form_number();
  ELSE NEW.form_number := OLD.form_number; END IF;
  NEW.retirement_date := CASE WHEN NEW.date_of_birth IS NULL THEN NULL ELSE (NEW.date_of_birth + interval '65 years')::date END;
  IF TG_OP='UPDATE' AND OLD.official_email IS NOT NULL THEN NEW.official_email := OLD.official_email;
  ELSE NEW.official_email := official_email_for(NEW.first_name, NEW.last_name, NEW.full_name, NEW.id); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hr_personnel_derive ON public.officers;
CREATE TRIGGER hr_personnel_derive BEFORE INSERT OR UPDATE ON public.officers FOR EACH ROW EXECUTE FUNCTION public.hr_personnel_derive();

-- Backfill existing records (form numbers by enrollment order, official emails, retirement dates)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.officers WHERE form_number IS NULL ORDER BY created_at, id LOOP
    UPDATE public.officers SET form_number = public.next_hr_form_number() WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.officers DISABLE TRIGGER hr_personnel_derive;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id, first_name, last_name, full_name FROM public.officers WHERE official_email IS NULL ORDER BY created_at, id LOOP
    UPDATE public.officers SET official_email = public.official_email_for(r.first_name, r.last_name, r.full_name, r.id) WHERE id = r.id;
  END LOOP;
END $$;
UPDATE public.officers SET retirement_date = (date_of_birth + interval '65 years')::date WHERE date_of_birth IS NOT NULL;
ALTER TABLE public.officers ENABLE TRIGGER hr_personnel_derive;

-- HR staff (incl. HR admin) may upload and read passport photos
DROP POLICY IF EXISTS "hr staff upload officer photos" ON storage.objects;
CREATE POLICY "hr staff upload officer photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='officer-files' AND public.hr_staff());
DROP POLICY IF EXISTS "ict reads officer photos" ON storage.objects;
CREATE POLICY "ict reads officer photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='officer-files' AND public.has_any_role(auth.uid(), ARRAY['ict_admin']::public.app_role[]) AND EXISTS (SELECT 1 FROM public.officers o WHERE o.photo_url = objects.name));