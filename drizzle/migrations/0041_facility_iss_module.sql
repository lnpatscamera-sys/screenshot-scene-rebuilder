CREATE SEQUENCE public.facility_wo_seq;
CREATE SEQUENCE public.iss_ob_seq;

CREATE TABLE public.facility_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('LNPATS/WO/' || to_char(now(),'YYYY') || '/' || lpad(nextval('public.facility_wo_seq')::text,4,'0')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  location text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','assigned','in_progress','completed','confirmed','cancelled')),
  reported_by uuid NOT NULL DEFAULT auth.uid(),
  reporter_name text,
  technician text,
  assigned_by uuid,
  assigned_at timestamptz,
  completion_notes text,
  completed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.facility_work_orders TO authenticated;
GRANT ALL ON public.facility_work_orders TO service_role;
ALTER TABLE public.facility_work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo read" ON public.facility_work_orders FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['facility_manager','commandant','dc_admin']::public.app_role[]));
CREATE POLICY "wo report" ON public.facility_work_orders FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() AND status = 'reported' AND technician IS NULL AND assigned_by IS NULL AND completed_at IS NULL AND confirmed_at IS NULL);
CREATE TRIGGER audit_facility_work_orders AFTER INSERT OR UPDATE OR DELETE ON public.facility_work_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.facility_action(_id uuid, _action text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.facility_work_orders; mgr boolean;
BEGIN
  SELECT * INTO w FROM public.facility_work_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;
  mgr := public.has_any_role(auth.uid(), ARRAY['facility_manager']::public.app_role[]);
  IF _action = 'assign' THEN
    IF NOT mgr THEN RAISE EXCEPTION 'Only the Facility Manager can assign work'; END IF;
    IF w.status NOT IN ('reported','assigned') THEN RAISE EXCEPTION 'Work order cannot be assigned now'; END IF;
    IF coalesce(trim(_payload->>'technician'),'') = '' THEN RAISE EXCEPTION 'Technician is required'; END IF;
    UPDATE public.facility_work_orders SET status='assigned', technician=trim(_payload->>'technician'), assigned_by=auth.uid(), assigned_at=now(), updated_at=now() WHERE id=_id;
  ELSIF _action = 'start' THEN
    IF NOT mgr OR w.status <> 'assigned' THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.facility_work_orders SET status='in_progress', updated_at=now() WHERE id=_id;
  ELSIF _action = 'complete' THEN
    IF NOT mgr OR w.status NOT IN ('assigned','in_progress') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.facility_work_orders SET status='completed', completion_notes=_payload->>'notes', completed_at=now(), updated_at=now() WHERE id=_id;
  ELSIF _action = 'confirm' THEN
    IF w.reported_by <> auth.uid() OR w.status <> 'completed' THEN RAISE EXCEPTION 'Only the requester can confirm completed work'; END IF;
    UPDATE public.facility_work_orders SET status='confirmed', confirmed_at=now(), updated_at=now() WHERE id=_id;
  ELSIF _action = 'reopen' THEN
    IF w.reported_by <> auth.uid() OR w.status <> 'completed' THEN RAISE EXCEPTION 'Only the requester can reopen completed work'; END IF;
    UPDATE public.facility_work_orders SET status='assigned', completion_notes=coalesce(_payload->>'notes', completion_notes), completed_at=NULL, updated_at=now() WHERE id=_id;
  ELSIF _action = 'cancel' THEN
    IF w.status IN ('completed','confirmed','cancelled') OR NOT (mgr OR w.reported_by = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.facility_work_orders SET status='cancelled', updated_at=now() WHERE id=_id;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.facility_action(uuid,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.facility_action(uuid,text,jsonb) TO authenticated;

CREATE TABLE public.iss_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL, id_number text, phone text, organization text,
  purpose text NOT NULL, host text, badge_number text,
  time_in timestamptz NOT NULL DEFAULT now(), time_out timestamptz,
  recorded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.iss_gate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL, driver_name text, direction text NOT NULL CHECK (direction IN ('In','Out')),
  purpose text, gate text NOT NULL DEFAULT 'Main Gate', logged_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.iss_duty_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post text NOT NULL, officer_name text NOT NULL, shift_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('Morning','Afternoon','Night')), notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.iss_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ob_number text NOT NULL UNIQUE DEFAULT ('LNPATS/OB/' || to_char(now(),'YYYY') || '/' || lpad(nextval('public.iss_ob_seq')::text,4,'0')),
  occurred_at timestamptz NOT NULL DEFAULT now(), location text NOT NULL, category text NOT NULL DEFAULT 'General',
  description text NOT NULL, action_taken text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_investigation','closed')),
  recorded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['iss_visitors','iss_gate_logs','iss_duty_roster','iss_occurrences'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "iss read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['iss_officer','commandant','dc_admin']::public.app_role[]))$p$, t);
    EXECUTE format($p$CREATE POLICY "iss insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['iss_officer']::public.app_role[]))$p$, t);
    EXECUTE format($p$CREATE POLICY "iss update" ON public.%I FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['iss_officer']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['iss_officer']::public.app_role[]))$p$, t);
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t, t);
  END LOOP;
END $$;