CREATE SEQUENCE public.training_program_code_seq START 1;
CREATE SEQUENCE public.cadet_number_seq START 1;
CREATE SEQUENCE public.instructor_code_seq START 1;
CREATE SEQUENCE public.certificate_number_seq START 1;
GRANT USAGE ON SEQUENCE public.training_program_code_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.cadet_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.instructor_code_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.certificate_number_seq TO authenticated;

ALTER TABLE public.training_programs
  ADD COLUMN program_code text,
  ADD COLUMN objectives text,
  ADD COLUMN max_enrollment integer,
  ADD COLUMN status text NOT NULL DEFAULT 'Active';
UPDATE public.training_programs SET program_code = 'LNPATS-TP-' || lpad(nextval('public.training_program_code_seq')::text, 4, '0') WHERE program_code IS NULL;
ALTER TABLE public.training_programs ALTER COLUMN program_code SET DEFAULT ('LNPATS-TP-' || lpad(nextval('public.training_program_code_seq')::text, 4, '0'));

ALTER TABLE public.cadets
  ADD COLUMN date_of_birth date,
  ADD COLUMN nationality text,
  ADD COLUMN email text,
  ADD COLUMN emergency_contact text,
  ADD COLUMN intake_number text,
  ADD COLUMN recruitment_date date,
  ADD COLUMN sponsoring_unit text,
  ADD COLUMN rank_before_admission text,
  ADD COLUMN program_id uuid REFERENCES public.training_programs(id),
  ADD COLUMN user_id uuid,
  ADD COLUMN documents jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.cadets SET cadet_number = 'LNPATS-CDT-' || lpad(nextval('public.cadet_number_seq')::text, 4, '0') WHERE cadet_number IS NULL;
ALTER TABLE public.cadets ALTER COLUMN cadet_number SET DEFAULT ('LNPATS-CDT-' || lpad(nextval('public.cadet_number_seq')::text, 4, '0'));

CREATE TABLE public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_code text DEFAULT ('LNPATS-INS-' || lpad(nextval('public.instructor_code_seq')::text, 4, '0')),
  officer_id uuid REFERENCES public.officers(id),
  name text NOT NULL,
  rank text,
  department text,
  qualification text,
  contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view instructors" ON public.instructors FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages instructors" ON public.instructors FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_instructors AFTER INSERT OR UPDATE OR DELETE ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

ALTER TABLE public.courses
  ADD COLUMN course_code text,
  ADD COLUMN instructor_id uuid REFERENCES public.instructors(id);

CREATE TABLE public.program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id uuid NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  enrolled_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'Active',
  UNIQUE (cadet_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_enrollments TO authenticated;
GRANT ALL ON public.program_enrollments TO service_role;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view enrollments" ON public.program_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages enrollments" ON public.program_enrollments FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_program_enrollments AFTER INSERT OR UPDATE OR DELETE ON public.program_enrollments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id uuid NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT current_date,
  status text NOT NULL,
  remarks text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cadet_id, course_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view attendance" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "instructors manage attendance" ON public.attendance_records FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy','section_head']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy','section_head']::public.app_role[]));
CREATE TRIGGER audit_attendance_records AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_code text,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assessment_type text NOT NULL,
  subject text NOT NULL,
  exam_date date NOT NULL,
  max_score numeric NOT NULL DEFAULT 100,
  passing_score numeric NOT NULL DEFAULT 50,
  results_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE public.assessment_code_seq START 1;
GRANT USAGE ON SEQUENCE public.assessment_code_seq TO authenticated;
ALTER TABLE public.assessments ALTER COLUMN exam_code SET DEFAULT ('LNPATS-EX-' || lpad(nextval('public.assessment_code_seq')::text, 4, '0'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view assessments" ON public.assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages assessments" ON public.assessments FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_assessments AFTER INSERT OR UPDATE OR DELETE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  cadet_id uuid NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  grade text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, cadet_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view results" ON public.assessment_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "instructors enter results" ON public.assessment_results FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy','section_head']::public.app_role[]));
CREATE POLICY "instructors update results" ON public.assessment_results FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy','section_head']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy','section_head']::public.app_role[]));
CREATE POLICY "academy deletes results" ON public.assessment_results FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_assessment_results AFTER INSERT OR UPDATE OR DELETE ON public.assessment_results FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.compute_assessment_grade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _max numeric; _pct numeric;
BEGIN
  SELECT max_score INTO _max FROM public.assessments WHERE id = NEW.assessment_id;
  _pct := CASE WHEN _max > 0 THEN NEW.score / _max * 100 ELSE 0 END;
  NEW.grade := CASE WHEN _pct >= 80 THEN 'A' WHEN _pct >= 70 THEN 'B' WHEN _pct >= 60 THEN 'C' WHEN _pct >= 50 THEN 'D' ELSE 'F' END;
  RETURN NEW;
END $$;
CREATE TRIGGER grade_assessment_result BEFORE INSERT OR UPDATE OF score, assessment_id ON public.assessment_results FOR EACH ROW EXECUTE FUNCTION public.compute_assessment_grade();

CREATE TABLE public.graduations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id uuid NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.training_programs(id),
  decision text NOT NULL DEFAULT 'Pending',
  decided_by uuid,
  decided_at timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.graduations TO authenticated;
GRANT ALL ON public.graduations TO service_role;
ALTER TABLE public.graduations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view graduations" ON public.graduations FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages graduations" ON public.graduations FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_graduations AFTER INSERT OR UPDATE OR DELETE ON public.graduations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  cadet_id uuid NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.training_programs(id),
  graduation_id uuid REFERENCES public.graduations(id),
  completion_date date NOT NULL DEFAULT current_date,
  signed_by text,
  verification_code text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users view certificates" ON public.certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages certificates" ON public.certificates FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));
CREATE TRIGGER audit_certificates AFTER INSERT OR UPDATE OR DELETE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.graduate_cadet(_cadet_id uuid, _decision text, _remarks text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _grad uuid; _program uuid; _cert text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['dc_academy','commandant']::public.app_role[]) THEN
    RAISE EXCEPTION 'Not authorized to decide graduation';
  END IF;
  IF _decision NOT IN ('Approved','Deferred','Re-assessment') THEN
    RAISE EXCEPTION 'Invalid graduation decision';
  END IF;
  SELECT program_id INTO _program FROM public.cadets WHERE id = _cadet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadet not found'; END IF;
  INSERT INTO public.graduations (cadet_id, program_id, decision, decided_by, decided_at, remarks)
  VALUES (_cadet_id, _program, _decision, auth.uid(), now(), _remarks) RETURNING id INTO _grad;
  IF _decision = 'Approved' THEN
    UPDATE public.cadets SET status = 'Graduated' WHERE id = _cadet_id;
    _cert := 'LNPATS-CERT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.certificate_number_seq')::text, 4, '0');
    INSERT INTO public.certificates (certificate_number, cadet_id, program_id, graduation_id, completion_date, signed_by)
    VALUES (_cert, _cadet_id, _program, _grad, current_date, (SELECT full_name FROM public.officers WHERE user_id = auth.uid() LIMIT 1));
  ELSIF _decision = 'Deferred' THEN
    UPDATE public.cadets SET status = 'Deferred' WHERE id = _cadet_id;
  END IF;
  RETURN _grad;
END $$;
REVOKE ALL ON FUNCTION public.graduate_cadet(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.graduate_cadet(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_certificate(_number text)
RETURNS TABLE(certificate_number text, cadet_name text, program_name text, completion_date date, cadet_status text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.certificate_number, trim(concat(cd.first_name, ' ', cd.last_name)), tp.title, c.completion_date, cd.status
  FROM public.certificates c
  JOIN public.cadets cd ON cd.id = c.cadet_id
  LEFT JOIN public.training_programs tp ON tp.id = c.program_id
  WHERE c.certificate_number = _number;
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO authenticated;

DROP POLICY "admin manages cadets" ON public.cadets;
CREATE POLICY "signed-in users view cadets" ON public.cadets FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages cadets" ON public.cadets FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));

DROP POLICY "admin manages training programs" ON public.training_programs;
CREATE POLICY "signed-in users view programs" ON public.training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages programs" ON public.training_programs FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));

DROP POLICY "admin manages courses" ON public.courses;
CREATE POLICY "signed-in users view courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy manages courses" ON public.courses FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dc_academy']::public.app_role[]));