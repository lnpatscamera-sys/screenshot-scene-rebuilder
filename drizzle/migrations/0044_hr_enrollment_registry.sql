ALTER TABLE public.officers
  ADD COLUMN IF NOT EXISTS personnel_category text,
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS enrollment_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_by uuid,
  ADD COLUMN IF NOT EXISTS email_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.officers ADD CONSTRAINT officers_enrollment_status_chk CHECK (enrollment_status IN ('pending','active'));
ALTER TABLE public.officers ADD CONSTRAINT officers_email_status_chk CHECK (email_status IN ('not_sent','sent'));
CREATE OR REPLACE FUNCTION public.hr_enrollment_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); END IF;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  IF TG_OP='UPDATE' AND NEW.email_status='sent' AND OLD.email_status IS DISTINCT FROM 'sent' THEN
    NEW.email_sent_at := now(); NEW.email_sent_by := auth.uid(); NEW.enrollment_status := 'active';
  ELSIF TG_OP='UPDATE' AND current_user='authenticated' THEN
    NEW.email_sent_at := OLD.email_sent_at; NEW.email_sent_by := OLD.email_sent_by;
    IF OLD.email_status='sent' THEN NEW.email_status := 'sent'; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN NEW.created_by := OLD.created_by; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hr_enrollment_stamp BEFORE INSERT OR UPDATE ON public.officers FOR EACH ROW EXECUTE FUNCTION public.hr_enrollment_stamp();