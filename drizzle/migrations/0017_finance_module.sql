-- Helpers
CREATE OR REPLACE FUNCTION public.finance_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(), ARRAY['finance_admin','finance_officer']::public.app_role[]) $$;
CREATE OR REPLACE FUNCTION public.finance_reader() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(), ARRAY['finance_admin','finance_officer','commandant','deputy_commandant','auditor']::public.app_role[]) $$;
CREATE OR REPLACE FUNCTION public.my_section() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT section_id FROM public.officers WHERE user_id=auth.uid() AND section_id IS NOT NULL LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.section_head_of(_section uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _section IS NOT NULL AND public.has_role(auth.uid(),'section_head') AND _section = public.my_section() $$;
GRANT EXECUTE ON FUNCTION public.finance_staff(), public.finance_reader(), public.my_section(), public.section_head_of(uuid) TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.finance_budget_seq;
CREATE SEQUENCE IF NOT EXISTS public.finance_expense_seq;
CREATE SEQUENCE IF NOT EXISTS public.finance_revenue_seq;
CREATE SEQUENCE IF NOT EXISTS public.finance_cash_seq;
CREATE SEQUENCE IF NOT EXISTS public.finance_procurement_seq;
GRANT USAGE ON SEQUENCE public.finance_budget_seq, public.finance_expense_seq, public.finance_revenue_seq, public.finance_cash_seq, public.finance_procurement_seq TO authenticated, service_role;

-- Audit: previous values
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS previous_details jsonb;
CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$ DECLARE rid text;headers jsonb; BEGIN rid:=coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'); BEGIN headers:=nullif(current_setting('request.headers',true),'')::jsonb; EXCEPTION WHEN OTHERS THEN headers:='{}'; END; INSERT INTO public.audit_logs(user_id,user_email,action,table_name,record_id,details,previous_details,ip_address) VALUES(auth.uid(),(SELECT email FROM public.profiles WHERE id=auth.uid()),TG_OP,TG_TABLE_NAME,rid,CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,coalesce(headers->>'x-forwarded-for',headers->>'cf-connecting-ip')); RETURN coalesce(NEW,OLD); END $function$;
CREATE POLICY "auditors read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['auditor','finance_admin']::public.app_role[]));

-- Budgets (allocated_amount is the approved amount)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS budget_number text DEFAULT ('LNPATS/BUD/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.finance_budget_seq')::text,4,'0')),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS requested_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funding_source text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Draft',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS budgets_number_key ON public.budgets(budget_number);
ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check CHECK (status IN ('Draft','Submitted','Approved','Rejected','Archived'));
ALTER TABLE public.budgets ADD CONSTRAINT budgets_requested_check CHECK (requested_amount >= 0);
COMMENT ON COLUMN public.budgets.allocated_amount IS 'Approved amount, set only by finance_workflow approval.';

CREATE TABLE public.budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_allocations TO authenticated; GRANT ALL ON public.budget_allocations TO service_role;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

-- Expenses (expense_type is the canonical category)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_number text DEFAULT ('LNPATS/EXP/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.finance_expense_seq')::text,4,'0')),
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id),
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id),
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES public.budgets(id),
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS stage integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_number_key ON public.expenses(expense_number);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('Pending','Approved','Rejected'));

CREATE TABLE public.revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_number text UNIQUE DEFAULT ('LNPATS/REV/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.finance_revenue_seq')::text,4,'0')),
  source text NOT NULL CHECK (source IN ('Government Appropriation','Tuition and Training Fees','Grants','Donations','Other Income')),
  received_date date NOT NULL DEFAULT current_date,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  received_by uuid REFERENCES public.officers(id),
  received_by_name text,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenues TO authenticated; GRANT ALL ON public.revenues TO service_role;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text UNIQUE DEFAULT ('LNPATS/CASH/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.finance_cash_seq')::text,4,'0')),
  officer_id uuid REFERENCES public.officers(id),
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  section_id uuid REFERENCES public.sections(id),
  purpose text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  justification text,
  date_required date,
  stage integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_requests TO authenticated; GRANT ALL ON public.cash_requests TO service_role;
ALTER TABLE public.cash_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.procurement_funding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text UNIQUE DEFAULT ('LNPATS/PRC/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.finance_procurement_seq')::text,4,'0')),
  section_id uuid REFERENCES public.sections(id),
  item_description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  estimated_cost numeric(18,2) NOT NULL CHECK (estimated_cost > 0),
  vendor_id uuid REFERENCES public.vendors(id),
  funding_code text,
  budget_id uuid REFERENCES public.budgets(id),
  is_ict boolean NOT NULL DEFAULT false,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  stage integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_funding TO authenticated; GRANT ALL ON public.procurement_funding TO service_role;
ALTER TABLE public.procurement_funding ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.finance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  record_id uuid NOT NULL,
  stage integer,
  level text,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  signature text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_approvals_record_idx ON public.finance_approvals(module, record_id);
GRANT SELECT ON public.finance_approvals TO authenticated; GRANT ALL ON public.finance_approvals TO service_role;
ALTER TABLE public.finance_approvals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.financial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  period_start date,
  period_end date,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.financial_reports TO authenticated; GRANT ALL ON public.financial_reports TO service_role;
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "admin manages budgets" ON public.budgets;
DROP POLICY IF EXISTS "admin manages expenses" ON public.expenses;
CREATE POLICY budgets_read ON public.budgets FOR SELECT TO authenticated USING (public.finance_reader() OR public.section_head_of(department) OR created_by=auth.uid());
CREATE POLICY budgets_insert ON public.budgets FOR INSERT TO authenticated WITH CHECK (public.finance_staff() OR public.section_head_of(department));
CREATE POLICY budgets_update ON public.budgets FOR UPDATE TO authenticated USING ((public.finance_staff() OR created_by=auth.uid()) AND status IN ('Draft','Rejected')) WITH CHECK (public.finance_staff() OR public.section_head_of(department));
CREATE POLICY budgets_delete ON public.budgets FOR DELETE TO authenticated USING ((public.finance_staff() OR created_by=auth.uid()) AND status='Draft');

CREATE POLICY allocations_read ON public.budget_allocations FOR SELECT TO authenticated USING (public.finance_reader() OR public.section_head_of(section_id));
CREATE POLICY allocations_write ON public.budget_allocations FOR ALL TO authenticated USING (public.finance_staff()) WITH CHECK (public.finance_staff());

CREATE POLICY expenses_read ON public.expenses FOR SELECT TO authenticated USING (public.finance_reader() OR created_by=auth.uid() OR public.section_head_of(section_id));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.finance_staff());
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated USING (public.finance_staff() AND status='Pending' AND stage=1) WITH CHECK (public.finance_staff());

CREATE POLICY revenues_read ON public.revenues FOR SELECT TO authenticated USING (public.finance_reader());
CREATE POLICY revenues_insert ON public.revenues FOR INSERT TO authenticated WITH CHECK (public.finance_staff());
CREATE POLICY revenues_update ON public.revenues FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'finance_admin')) WITH CHECK (public.has_role(auth.uid(),'finance_admin'));

CREATE POLICY cash_read ON public.cash_requests FOR SELECT TO authenticated USING (public.finance_reader() OR requested_by=auth.uid() OR public.section_head_of(section_id));
CREATE POLICY cash_insert ON public.cash_requests FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid());
CREATE POLICY cash_update ON public.cash_requests FOR UPDATE TO authenticated USING (requested_by=auth.uid() AND stage=0) WITH CHECK (requested_by=auth.uid());
CREATE POLICY cash_delete ON public.cash_requests FOR DELETE TO authenticated USING (requested_by=auth.uid() AND stage=0);

CREATE POLICY procurement_read ON public.procurement_funding FOR SELECT TO authenticated USING (public.finance_reader() OR requested_by=auth.uid() OR public.section_head_of(section_id) OR public.has_any_role(auth.uid(), ARRAY['procurement_officer','ict_admin']::public.app_role[]));
CREATE POLICY procurement_insert ON public.procurement_funding FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND (public.finance_staff() OR public.section_head_of(section_id) OR public.has_role(auth.uid(),'procurement_officer')));
CREATE POLICY procurement_update ON public.procurement_funding FOR UPDATE TO authenticated USING (requested_by=auth.uid() AND stage=0) WITH CHECK (requested_by=auth.uid());
CREATE POLICY procurement_delete ON public.procurement_funding FOR DELETE TO authenticated USING (requested_by=auth.uid() AND stage=0);

CREATE POLICY approvals_read ON public.finance_approvals FOR SELECT TO authenticated USING (
  public.finance_reader() OR public.has_any_role(auth.uid(), ARRAY['procurement_officer','ict_admin','section_head']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.cash_requests c WHERE c.id=record_id AND c.requested_by=auth.uid())
  OR EXISTS (SELECT 1 FROM public.procurement_funding p WHERE p.id=record_id AND p.requested_by=auth.uid()));

CREATE POLICY reports_read ON public.financial_reports FOR SELECT TO authenticated USING (public.finance_reader());
CREATE POLICY reports_insert ON public.financial_reports FOR INSERT TO authenticated WITH CHECK (generated_by=auth.uid() AND public.has_any_role(auth.uid(), ARRAY['finance_admin','finance_officer','commandant']::public.app_role[]));

-- Workflow guards: state fields change only inside finance_workflow
CREATE OR REPLACE FUNCTION public.guard_finance_state() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE rpc boolean := coalesce(current_setting('lnpats.finance_rpc', true),'') = 'on';
BEGIN
  IF rpc THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    NEW.history := '[]'::jsonb;
    IF TG_TABLE_NAME='budgets' THEN NEW.status:='Draft'; NEW.allocated_amount:=0; NEW.used_amount:=0; NEW.remaining_amount:=0; NEW.created_by:=auth.uid();
    ELSIF TG_TABLE_NAME='expenses' THEN NEW.status:='Pending'; NEW.stage:=1; NEW.created_by:=auth.uid();
    ELSE NEW.status:='Draft'; NEW.stage:=0; END IF;
    RETURN NEW;
  END IF;
  IF NEW.history IS DISTINCT FROM OLD.history OR NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Workflow state changes only through approvals'; END IF;
  IF TG_TABLE_NAME='budgets' THEN
    IF NEW.allocated_amount IS DISTINCT FROM OLD.allocated_amount OR NEW.used_amount IS DISTINCT FROM OLD.used_amount OR NEW.remaining_amount IS DISTINCT FROM OLD.remaining_amount OR NEW.budget_number IS DISTINCT FROM OLD.budget_number THEN RAISE EXCEPTION 'Budget amounts change only through approvals'; END IF;
  ELSE
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN RAISE EXCEPTION 'Workflow state changes only through approvals'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_budgets_state BEFORE INSERT OR UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.guard_finance_state();
CREATE TRIGGER guard_expenses_state BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.guard_finance_state();
CREATE TRIGGER guard_cash_state BEFORE INSERT OR UPDATE ON public.cash_requests FOR EACH ROW EXECUTE FUNCTION public.guard_finance_state();
CREATE TRIGGER guard_procurement_state BEFORE INSERT OR UPDATE ON public.procurement_funding FOR EACH ROW EXECUTE FUNCTION public.guard_finance_state();

-- Allocations must stay within the approved budget
CREATE OR REPLACE FUNCTION public.validate_budget_allocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.budgets; total numeric;
BEGIN
  SELECT * INTO b FROM public.budgets WHERE id=NEW.budget_id FOR UPDATE;
  IF b.status <> 'Approved' THEN RAISE EXCEPTION 'Only approved budgets can be allocated'; END IF;
  SELECT coalesce(sum(amount),0) INTO total FROM public.budget_allocations WHERE budget_id=NEW.budget_id AND id<>NEW.id;
  IF total + NEW.amount > coalesce(b.allocated_amount,0) THEN RAISE EXCEPTION 'Allocations exceed the approved budget'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_budget_allocation BEFORE INSERT OR UPDATE ON public.budget_allocations FOR EACH ROW EXECUTE FUNCTION public.validate_budget_allocation();

-- Approved expenses update budget utilisation
CREATE OR REPLACE FUNCTION public.sync_budget_spend() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.budget_id IS NOT NULL THEN ids := ids || OLD.budget_id; END IF;
  IF TG_OP <> 'DELETE' AND NEW.budget_id IS NOT NULL THEN ids := ids || NEW.budget_id; END IF;
  IF array_length(ids,1) IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
  PERFORM set_config('lnpats.finance_rpc','on',true);
  UPDATE public.budgets b SET used_amount = s.used, remaining_amount = coalesce(b.allocated_amount,0) - s.used
  FROM (SELECT bid, coalesce((SELECT sum(amount) FROM public.expenses e WHERE e.budget_id=bid AND e.status='Approved'),0) AS used FROM unnest(ids) bid) s
  WHERE b.id = s.bid;
  RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER sync_budget_spend AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.sync_budget_spend();

CREATE TRIGGER validate_expense_files BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.validate_phase2_files();

-- Workflow RPC
CREATE OR REPLACE FUNCTION public.finance_workflow(_module text, _id uuid, _action text, _note text DEFAULT NULL, _amount numeric DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid(); actor text; entry jsonb; lvl text; st int; nst int; nstatus text; allowed boolean := false;
  b public.budgets; e public.expenses; c public.cash_requests; p public.procurement_funding;
  high_value constant numeric := 10000;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _action NOT IN ('submit','approve','reject','archive','release','close') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  PERFORM set_config('lnpats.finance_rpc','on',true);
  SELECT coalesce(nullif(full_name,''),email) INTO actor FROM public.profiles WHERE id=uid;

  IF _module='budgets' THEN
    SELECT * INTO b FROM public.budgets WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    st := 0; lvl := 'Budget';
    IF _action='submit' AND b.status IN ('Draft','Rejected') AND (b.created_by=uid OR public.finance_staff()) THEN nstatus:='Submitted'; lvl:='Department'; allowed:=true;
    ELSIF _action IN ('approve','reject') AND b.status='Submitted' AND public.has_any_role(uid, ARRAY['finance_admin','commandant']::public.app_role[]) THEN
      nstatus := CASE WHEN _action='approve' THEN 'Approved' ELSE 'Rejected' END; lvl:='Final Approval'; allowed:=true;
    ELSIF _action='archive' AND b.status IN ('Approved','Rejected') AND public.finance_staff() THEN nstatus:='Archived'; allowed:=true; END IF;
    IF NOT allowed THEN RAISE EXCEPTION 'Not authorised for this budget action'; END IF;
    IF _action='reject' AND coalesce(trim(_note),'')='' THEN RAISE EXCEPTION 'A reason is required to reject'; END IF;
    entry := jsonb_build_object('action',_action,'by',actor,'at',now(),'note',_note);
    UPDATE public.budgets SET status=nstatus, history=history||entry,
      allocated_amount = CASE WHEN _action='approve' THEN coalesce(_amount, requested_amount) ELSE allocated_amount END,
      remaining_amount = CASE WHEN _action='approve' THEN coalesce(_amount, requested_amount) - coalesce(used_amount,0) ELSE remaining_amount END
    WHERE id=_id;

  ELSIF _module='expenses' THEN
    SELECT * INTO e FROM public.expenses WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF _action NOT IN ('approve','reject') OR e.status<>'Pending' THEN RAISE EXCEPTION 'Invalid expense action'; END IF;
    st := e.stage;
    IF st=1 AND public.finance_staff() THEN lvl:='Finance Officer'; allowed:=true;
    ELSIF st=2 AND public.has_role(uid,'commandant') THEN lvl:='Commandant'; allowed:=true; END IF;
    IF NOT allowed THEN RAISE EXCEPTION 'Not authorised at this approval level'; END IF;
    IF _action='reject' THEN nst:=st; nstatus:='Rejected';
    ELSIF st=1 AND e.amount > high_value THEN nst:=2; nstatus:='Pending';
    ELSE nst:=st; nstatus:='Approved'; END IF;
    entry := jsonb_build_object('action',_action,'by',actor,'at',now(),'note',_note,'stage',st);
    UPDATE public.expenses SET stage=nst, status=nstatus, history=history||entry WHERE id=_id;
    IF nst=2 AND nstatus='Pending' THEN INSERT INTO public.notifications(role,title,body) VALUES('commandant','High-value expense awaiting approval', e.expense_number||' · '||e.amount); END IF;

  ELSIF _module='cash_requests' THEN
    SELECT * INTO c FROM public.cash_requests WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    st := c.stage;
    IF _action='submit' AND st=0 AND c.requested_by=uid THEN nst:=1; nstatus:='Pending Supervisor'; lvl:='Requesting Officer'; allowed:=true;
    ELSIF _action IN ('approve','reject') AND c.status NOT IN ('Rejected') AND (
      (st=1 AND public.section_head_of(c.section_id)) OR (st=1 AND public.has_role(uid,'system_admin')) OR
      (st=2 AND public.finance_staff()) OR (st=3 AND public.has_role(uid,'commandant'))) THEN
      lvl := CASE st WHEN 1 THEN 'Department Head' WHEN 2 THEN 'Finance Officer' ELSE 'Commandant' END; allowed:=true;
      IF c.requested_by=uid AND NOT public.has_role(uid,'system_admin') THEN RAISE EXCEPTION 'You cannot approve your own request'; END IF;
      IF _action='reject' THEN nst:=st; nstatus:='Rejected';
      ELSE nst:=st+1; nstatus := CASE nst WHEN 2 THEN 'Pending Finance' WHEN 3 THEN 'Pending Commandant' ELSE 'Approved' END; END IF;
    ELSIF _action='release' AND st=4 AND public.finance_staff() THEN nst:=5; nstatus:='Funds Released'; lvl:='Finance Officer'; allowed:=true;
    ELSIF _action='close' AND st=5 AND (public.finance_staff() OR c.requested_by=uid) THEN nst:=6; nstatus:='Closed'; lvl:='Finance Officer'; allowed:=true; END IF;
    IF NOT allowed THEN RAISE EXCEPTION 'Not authorised at this approval level'; END IF;
    entry := jsonb_build_object('action',_action,'by',actor,'at',now(),'note',_note,'stage',st);
    UPDATE public.cash_requests SET stage=nst, status=nstatus, history=history||entry WHERE id=_id;
    INSERT INTO public.notifications(user_id,title,body) VALUES(c.requested_by,'Cash request '||lower(nstatus), c.request_number);

  ELSIF _module='procurement_funding' THEN
    SELECT * INTO p FROM public.procurement_funding WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    st := p.stage;
    IF _action='submit' AND st=0 AND p.requested_by=uid THEN nst:=1; nstatus:='Pending Department Head'; lvl:='Department'; allowed:=true;
    ELSIF _action IN ('approve','reject') AND p.status<>'Rejected' AND (
      (st=1 AND (public.section_head_of(p.section_id) OR public.has_role(uid,'system_admin'))) OR (st=2 AND public.has_role(uid,'procurement_officer')) OR
      (st=3 AND public.finance_staff()) OR (st=4 AND public.has_role(uid,'ict_admin')) OR (st=5 AND public.has_role(uid,'commandant'))) THEN
      lvl := CASE st WHEN 1 THEN 'Department Head' WHEN 2 THEN 'Procurement Officer' WHEN 3 THEN 'Finance Officer' WHEN 4 THEN 'Chief of ICT' ELSE 'Commandant' END; allowed:=true;
      IF _action='reject' THEN nst:=st; nstatus:='Rejected';
      ELSE nst := st+1; IF nst=4 AND NOT p.is_ict THEN nst:=5; END IF;
        nstatus := CASE nst WHEN 2 THEN 'Pending Procurement' WHEN 3 THEN 'Pending Finance' WHEN 4 THEN 'Pending Chief of ICT' WHEN 5 THEN 'Pending Commandant' ELSE 'Approved' END; END IF;
    END IF;
    IF NOT allowed THEN RAISE EXCEPTION 'Not authorised at this approval level'; END IF;
    entry := jsonb_build_object('action',_action,'by',actor,'at',now(),'note',_note,'stage',st);
    UPDATE public.procurement_funding SET stage=nst, status=nstatus, history=history||entry WHERE id=_id;
    INSERT INTO public.notifications(user_id,title,body) VALUES(p.requested_by,'Procurement request '||lower(nstatus), p.request_number);
  ELSE
    RAISE EXCEPTION 'Unknown module';
  END IF;

  INSERT INTO public.finance_approvals(module,record_id,stage,level,action,actor_id,actor_name,signature,note)
  VALUES(_module,_id,st,lvl,_action,uid,actor,CASE WHEN _action IN ('approve','release') THEN actor END,_note);
END $$;
REVOKE ALL ON FUNCTION public.finance_workflow(text,uuid,text,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_workflow(text,uuid,text,text,numeric) TO authenticated;

-- Attachment access for expenses
CREATE OR REPLACE FUNCTION public.record_activity(_module text, _id uuid, _action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$ DECLARE allowed boolean:=false; BEGIN IF _action NOT IN ('VIEW','DOWNLOAD') THEN RAISE EXCEPTION 'Invalid activity'; END IF; IF _module='documents' THEN allowed:=public.can_read_document(_id); ELSIF _module='registry' THEN SELECT EXISTS(SELECT 1 FROM public.correspondence c WHERE c.id=_id AND (public.phase2_admin() OR public.has_any_role(auth.uid(),ARRAY['registry_officer','deputy_commandant']::public.app_role[]) OR c.created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.officers WHERE id=c.officer_id AND user_id=auth.uid()))) INTO allowed; ELSIF _module='leave' THEN SELECT EXISTS(SELECT 1 FROM public.leave_requests WHERE id=_id AND (requested_by=auth.uid() OR public.has_any_role(auth.uid(),ARRAY['section_head','assistant_commissioner','dc_admin','dc_academy','hr_officer','commandant']::public.app_role[]))) INTO allowed; ELSIF _module='expenses' THEN SELECT EXISTS(SELECT 1 FROM public.expenses WHERE id=_id AND (public.finance_reader() OR created_by=auth.uid())) INTO allowed; END IF; IF NOT allowed THEN RAISE EXCEPTION 'Not authorised'; END IF; INSERT INTO public.audit_logs(user_id,user_email,action,table_name,record_id,ip_address) VALUES(auth.uid(),(SELECT email FROM public.profiles WHERE id=auth.uid()),_action,_module,_id::text,nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for'); END $function$;
CREATE POLICY finance_storage_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='phase2-files' AND EXISTS (SELECT 1 FROM public.expenses e CROSS JOIN LATERAL jsonb_array_elements(e.attachments) f(value) WHERE f.value->>'path' = objects.name));

-- Audit every finance table
CREATE TRIGGER audit_budget_allocations AFTER INSERT OR UPDATE OR DELETE ON public.budget_allocations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_revenues AFTER INSERT OR UPDATE OR DELETE ON public.revenues FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_cash_requests AFTER INSERT OR UPDATE OR DELETE ON public.cash_requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_procurement_funding AFTER INSERT OR UPDATE OR DELETE ON public.procurement_funding FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_finance_approvals AFTER INSERT ON public.finance_approvals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_financial_reports AFTER INSERT ON public.financial_reports FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();