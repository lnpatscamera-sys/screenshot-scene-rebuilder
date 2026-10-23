-- Procurement helpers
CREATE OR REPLACE FUNCTION public.procurement_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(), ARRAY['procurement_admin','procurement_officer']::public.app_role[]) $$;
CREATE OR REPLACE FUNCTION public.procurement_reader() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(), ARRAY['procurement_admin','procurement_officer','finance_admin','finance_officer','commandant','deputy_commandant','auditor','storekeeper']::public.app_role[]) $$;
GRANT EXECUTE ON FUNCTION public.procurement_staff(), public.procurement_reader() TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.proc_vendor_seq;
CREATE SEQUENCE IF NOT EXISTS public.proc_rfq_seq;
CREATE SEQUENCE IF NOT EXISTS public.proc_po_seq;
CREATE SEQUENCE IF NOT EXISTS public.proc_grn_seq;
CREATE SEQUENCE IF NOT EXISTS public.proc_contract_seq;
GRANT USAGE ON SEQUENCE public.proc_vendor_seq, public.proc_rfq_seq, public.proc_po_seq, public.proc_grn_seq, public.proc_contract_seq TO authenticated, service_role;

-- Vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_code text DEFAULT ('LNPATS/VEN/'||lpad(nextval('public.proc_vendor_seq')::text,4,'0')),
  ADD COLUMN IF NOT EXISTS tin text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS vendors_code_key ON public.vendors(vendor_code);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_status_check CHECK (status IN ('Active','Suspended'));
ALTER TABLE public.vendors ADD CONSTRAINT vendors_category_check CHECK (category IS NULL OR category IN ('Office Supplies','ICT Equipment','Vehicles','Construction','Training Materials','Medical Supplies','Uniforms','Fuel Suppliers','Equipment Maintenance'));
CREATE POLICY vendors_proc_read ON public.vendors FOR SELECT TO authenticated USING (public.procurement_reader() OR public.has_role(auth.uid(),'section_head'));
CREATE POLICY vendors_proc_insert ON public.vendors FOR INSERT TO authenticated WITH CHECK (public.procurement_staff());
CREATE POLICY vendors_proc_update ON public.vendors FOR UPDATE TO authenticated USING (public.procurement_staff()) WITH CHECK (public.procurement_staff());

-- Purchase requests (canonical: procurement_funding, approved through finance_workflow)
ALTER TABLE public.procurement_funding
  ADD COLUMN IF NOT EXISTS request_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS justification text,
  ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.procurement_funding ADD CONSTRAINT procurement_priority_check CHECK (priority IN ('Low','Medium','High','Emergency'));
CREATE POLICY procurement_admin_read ON public.procurement_funding FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY procurement_admin_insert ON public.procurement_funding FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND public.has_role(auth.uid(),'procurement_admin'));
COMMENT ON TABLE public.purchase_requests IS 'DEPRECATED: purchase requisitions live in procurement_funding.';

CREATE TABLE public.request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.procurement_funding(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text,
  estimated_unit_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (estimated_unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_items TO authenticated; GRANT ALL ON public.request_items TO service_role;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY request_items_read ON public.request_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.procurement_funding p WHERE p.id=request_id));
CREATE POLICY request_items_write ON public.request_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.procurement_funding p WHERE p.id=request_id AND p.stage=0 AND p.requested_by=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.procurement_funding p WHERE p.id=request_id AND p.stage=0 AND p.requested_by=auth.uid()));
CREATE OR REPLACE FUNCTION public.sync_request_total() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid := coalesce(NEW.request_id, OLD.request_id); t numeric; q integer;
BEGIN
  SELECT sum(quantity*estimated_unit_cost), sum(quantity) INTO t, q FROM public.request_items WHERE request_id=rid;
  IF t IS NOT NULL AND t > 0 THEN UPDATE public.procurement_funding SET estimated_cost=t, quantity=q WHERE id=rid AND stage=0; END IF;
  RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER sync_request_total AFTER INSERT OR UPDATE OR DELETE ON public.request_items FOR EACH ROW EXECUTE FUNCTION public.sync_request_total();

-- Quotations (RFQ)
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number text UNIQUE DEFAULT ('LNPATS/RFQ/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.proc_rfq_seq')::text,4,'0')),
  request_id uuid NOT NULL REFERENCES public.procurement_funding(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  status text NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested','Received','Declined')),
  rfq_sent_at timestamptz NOT NULL DEFAULT now(),
  quoted_amount numeric(18,2) CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
  delivery_days integer CHECK (delivery_days IS NULL OR delivery_days >= 0),
  validity_days integer CHECK (validity_days IS NULL OR validity_days >= 0),
  warranty text,
  remarks text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  received_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, vendor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated; GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotations_read ON public.quotations FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY quotations_insert ON public.quotations FOR INSERT TO authenticated WITH CHECK (public.procurement_staff());
CREATE POLICY quotations_update ON public.quotations FOR UPDATE TO authenticated USING (public.procurement_staff()) WITH CHECK (public.procurement_staff());
CREATE POLICY quotations_delete ON public.quotations FOR DELETE TO authenticated USING (public.procurement_staff() AND status='Requested');
CREATE OR REPLACE FUNCTION public.validate_quotation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.procurement_funding WHERE id=NEW.request_id AND stage>=1 AND status<>'Rejected') THEN RAISE EXCEPTION 'RFQs can only be sent for submitted requests'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id=NEW.vendor_id AND status='Active') THEN RAISE EXCEPTION 'Vendor is suspended'; END IF;
  END IF;
  IF NEW.status='Received' THEN
    IF NEW.quoted_amount IS NULL OR NEW.delivery_days IS NULL THEN RAISE EXCEPTION 'Quoted amount and delivery time are required'; END IF;
    NEW.received_at := coalesce(NEW.received_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_quotation BEFORE INSERT OR UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.validate_quotation();
CREATE TRIGGER validate_quotation_files BEFORE INSERT OR UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.validate_phase2_files();

CREATE TABLE public.quotation_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.procurement_funding(id) ON DELETE CASCADE,
  lowest_quotation_id uuid REFERENCES public.quotations(id),
  selected_quotation_id uuid NOT NULL REFERENCES public.quotations(id),
  justification text,
  decided_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_comparisons TO authenticated; GRANT ALL ON public.quotation_comparisons TO service_role;
ALTER TABLE public.quotation_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY comparisons_read ON public.quotation_comparisons FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY comparisons_write ON public.quotation_comparisons FOR ALL TO authenticated USING (public.procurement_staff()) WITH CHECK (public.procurement_staff());
CREATE OR REPLACE FUNCTION public.prepare_comparison() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  SELECT id INTO NEW.lowest_quotation_id FROM public.quotations WHERE request_id=NEW.request_id AND status='Received' ORDER BY quoted_amount, delivery_days, received_at LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM public.quotations WHERE id=NEW.selected_quotation_id AND request_id=NEW.request_id AND status='Received') THEN RAISE EXCEPTION 'Select a received quotation for this request'; END IF;
  IF NEW.selected_quotation_id IS DISTINCT FROM NEW.lowest_quotation_id AND coalesce(trim(NEW.justification),'')='' THEN RAISE EXCEPTION 'Justify choosing a bidder other than the lowest evaluated bidder'; END IF;
  NEW.decided_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER prepare_comparison BEFORE INSERT OR UPDATE ON public.quotation_comparisons FOR EACH ROW EXECUTE FUNCTION public.prepare_comparison();

-- Purchase orders
ALTER TABLE public.purchase_orders
  ALTER COLUMN po_number SET DEFAULT ('LNPATS/PO/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.proc_po_seq')::text,4,'0')),
  ALTER COLUMN status SET DEFAULT 'Draft',
  ALTER COLUMN amount SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS procurement_request_id uuid REFERENCES public.procurement_funding(id),
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations(id),
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_number_key ON public.purchase_orders(po_number);
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('Draft','Approved','Sent','Partially Delivered','Completed','Cancelled'));
COMMENT ON COLUMN public.purchase_orders.request_id IS 'DEPRECATED: replaced by procurement_request_id.';
CREATE POLICY po_read ON public.purchase_orders FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY po_insert ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.procurement_staff());
CREATE POLICY po_update ON public.purchase_orders FOR UPDATE TO authenticated USING (public.procurement_staff() AND status='Draft') WITH CHECK (public.procurement_staff());
CREATE POLICY po_delete ON public.purchase_orders FOR DELETE TO authenticated USING (public.procurement_staff() AND status='Draft');

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id),
  is_asset boolean NOT NULL DEFAULT false,
  asset_category text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  quantity_received integer NOT NULL DEFAULT 0,
  quantity_rejected integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated; GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_items_read ON public.purchase_order_items FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY po_items_write ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.procurement_staff() AND EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id=po_id AND o.status='Draft'))
  WITH CHECK (public.procurement_staff() AND EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id=po_id AND o.status='Draft'));

CREATE OR REPLACE FUNCTION public.guard_purchase_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rpc boolean := coalesce(current_setting('lnpats.proc_rpc', true),'') = 'on'; r public.procurement_funding;
BEGIN
  IF rpc THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    NEW.status:='Draft'; NEW.history:='[]'::jsonb; NEW.amount:=0; NEW.created_by:=auth.uid();
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.history IS DISTINCT FROM OLD.history OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.po_number IS DISTINCT FROM OLD.po_number THEN RAISE EXCEPTION 'Purchase order status changes only through approvals'; END IF;
  END IF;
  SELECT * INTO r FROM public.procurement_funding WHERE id=NEW.procurement_request_id;
  IF NOT FOUND OR r.status<>'Approved' THEN RAISE EXCEPTION 'Purchase orders need a fully approved purchase request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id=NEW.vendor_id AND status='Active') THEN RAISE EXCEPTION 'Choose an active vendor'; END IF;
  IF NEW.quotation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.quotations WHERE id=NEW.quotation_id AND request_id=NEW.procurement_request_id AND vendor_id=NEW.vendor_id) THEN RAISE EXCEPTION 'Quotation does not match this request and vendor'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_purchase_order BEFORE INSERT OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_order();

CREATE OR REPLACE FUNCTION public.link_purchase_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.procurement_funding SET purchase_order_id=NEW.id WHERE id=NEW.procurement_request_id AND purchase_order_id IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER link_purchase_order AFTER INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.link_purchase_order();

CREATE OR REPLACE FUNCTION public.guard_po_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rpc boolean := coalesce(current_setting('lnpats.proc_rpc', true),'') = 'on';
BEGIN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT rpc THEN
    IF TG_OP='INSERT' THEN NEW.quantity_received:=0; NEW.quantity_rejected:=0;
    ELSIF NEW.quantity_received IS DISTINCT FROM OLD.quantity_received OR NEW.quantity_rejected IS DISTINCT FROM OLD.quantity_rejected THEN RAISE EXCEPTION 'Delivered quantities change only through goods received notes'; END IF;
  END IF;
  IF NEW.is_asset AND NEW.inventory_item_id IS NOT NULL THEN RAISE EXCEPTION 'A line is either a stock item or a capital asset'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_po_item BEFORE INSERT OR UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.guard_po_item();

CREATE OR REPLACE FUNCTION public.sync_po_amount() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := coalesce(NEW.po_id, OLD.po_id); prev text;
BEGIN
  prev := coalesce(current_setting('lnpats.proc_rpc', true),'');
  PERFORM set_config('lnpats.proc_rpc','on',true);
  UPDATE public.purchase_orders SET amount=(SELECT coalesce(sum(quantity*unit_price),0) FROM public.purchase_order_items WHERE po_id=pid) WHERE id=pid;
  PERFORM set_config('lnpats.proc_rpc',prev,true);
  RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER sync_po_amount AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.sync_po_amount();

-- Goods received notes
CREATE TABLE public.goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text UNIQUE DEFAULT ('LNPATS/GRN/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.proc_grn_seq')::text,4,'0')),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  vendor_id uuid REFERENCES public.vendors(id),
  delivery_date date NOT NULL DEFAULT current_date,
  received_by uuid DEFAULT auth.uid(),
  received_by_name text,
  warehouse_id uuid REFERENCES public.warehouses(id),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  damages text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_received_notes TO authenticated; GRANT ALL ON public.goods_received_notes TO service_role;
ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY grn_read ON public.goods_received_notes FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY grn_insert ON public.goods_received_notes FOR INSERT TO authenticated WITH CHECK (public.procurement_staff() OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY grn_update ON public.goods_received_notes FOR UPDATE TO authenticated USING ((public.procurement_staff() OR public.has_role(auth.uid(),'storekeeper')) AND status='Pending') WITH CHECK (public.procurement_staff() OR public.has_role(auth.uid(),'storekeeper'));
CREATE OR REPLACE FUNCTION public.guard_grn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rpc boolean := coalesce(current_setting('lnpats.proc_rpc', true),'') = 'on'; po public.purchase_orders; l jsonb;
BEGIN
  IF rpc THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN NEW.status:='Pending'; NEW.history:='[]'::jsonb; NEW.received_by:=auth.uid(); NEW.approved_by:=NULL; NEW.approved_at:=NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.history IS DISTINCT FROM OLD.history OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN RAISE EXCEPTION 'GRN status changes only through approvals'; END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id=NEW.po_id;
  IF NOT FOUND OR po.status NOT IN ('Approved','Sent','Partially Delivered') THEN RAISE EXCEPTION 'Goods can only be received against an approved purchase order'; END IF;
  NEW.vendor_id := po.vendor_id;
  IF jsonb_typeof(NEW.lines)<>'array' OR jsonb_array_length(NEW.lines)=0 THEN RAISE EXCEPTION 'Record at least one delivered line'; END IF;
  FOR l IN SELECT value FROM jsonb_array_elements(NEW.lines) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE id=(l->>'po_item_id')::uuid AND po_id=NEW.po_id) THEN RAISE EXCEPTION 'Line does not belong to this purchase order'; END IF;
    IF coalesce((l->>'delivered')::int,-1)<0 OR coalesce((l->>'accepted')::int,-1)<0 OR coalesce((l->>'rejected')::int,-1)<0 OR (l->>'delivered')::int <> (l->>'accepted')::int + (l->>'rejected')::int THEN RAISE EXCEPTION 'Delivered must equal accepted plus rejected'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_grn BEFORE INSERT OR UPDATE ON public.goods_received_notes FOR EACH ROW EXECUTE FUNCTION public.guard_grn();
CREATE TRIGGER validate_grn_files BEFORE INSERT OR UPDATE ON public.goods_received_notes FOR EACH ROW EXECUTE FUNCTION public.validate_phase2_files();

-- Contracts
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text UNIQUE DEFAULT ('LNPATS/CON/'||to_char(now(),'YYYY')||'/'||lpad(nextval('public.proc_contract_seq')::text,4,'0')),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  title text NOT NULL,
  contract_value numeric(18,2) NOT NULL CHECK (contract_value >= 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  manager_id uuid REFERENCES public.officers(id),
  po_id uuid REFERENCES public.purchase_orders(id),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Terminated')),
  renewal_count integer NOT NULL DEFAULT 0,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated; GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_read ON public.contracts FOR SELECT TO authenticated USING (public.procurement_reader() OR EXISTS (SELECT 1 FROM public.officers o WHERE o.id=manager_id AND o.user_id=auth.uid()));
CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.procurement_staff());
CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO authenticated USING (public.procurement_staff() AND status='Active') WITH CHECK (public.procurement_staff());
CREATE OR REPLACE FUNCTION public.guard_contract() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF coalesce(current_setting('lnpats.proc_rpc', true),'') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN NEW.status:='Active'; NEW.history:='[]'::jsonb; NEW.renewal_count:=0; NEW.created_by:=auth.uid();
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.history IS DISTINCT FROM OLD.history OR NEW.renewal_count IS DISTINCT FROM OLD.renewal_count OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN RAISE EXCEPTION 'Use Renew or Terminate to change the contract term'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_contract BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.guard_contract();
CREATE TRIGGER validate_contract_files BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.validate_phase2_files();

-- Supplier performance
CREATE TABLE public.supplier_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  po_id uuid REFERENCES public.purchase_orders(id),
  grn_id uuid UNIQUE REFERENCES public.goods_received_notes(id),
  timeliness numeric(3,1) CHECK (timeliness BETWEEN 1 AND 5),
  quality numeric(3,1) CHECK (quality BETWEEN 1 AND 5),
  pricing numeric(3,1) CHECK (pricing BETWEEN 1 AND 5),
  compliance numeric(3,1) CHECK (compliance BETWEEN 1 AND 5),
  service numeric(3,1) CHECK (service BETWEEN 1 AND 5),
  score numeric GENERATED ALWAYS AS (round(20 * (coalesce(timeliness,0)+coalesce(quality,0)+coalesce(pricing,0)+coalesce(compliance,0)+coalesce(service,0)) / nullif((timeliness IS NOT NULL)::int+(quality IS NOT NULL)::int+(pricing IS NOT NULL)::int+(compliance IS NOT NULL)::int+(service IS NOT NULL)::int,0), 1)) STORED,
  remarks text,
  rated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supplier_performance TO authenticated; GRANT ALL ON public.supplier_performance TO service_role;
ALTER TABLE public.supplier_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY performance_read ON public.supplier_performance FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY performance_insert ON public.supplier_performance FOR INSERT TO authenticated WITH CHECK (public.procurement_staff() AND grn_id IS NULL);
CREATE POLICY performance_update ON public.supplier_performance FOR UPDATE TO authenticated USING (public.procurement_staff()) WITH CHECK (public.procurement_staff());

CREATE TABLE public.procurement_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  period_start date,
  period_end date,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.procurement_reports TO authenticated; GRANT ALL ON public.procurement_reports TO service_role;
ALTER TABLE public.procurement_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY proc_reports_read ON public.procurement_reports FOR SELECT TO authenticated USING (public.procurement_reader());
CREATE POLICY proc_reports_insert ON public.procurement_reports FOR INSERT TO authenticated WITH CHECK (generated_by=auth.uid() AND public.procurement_reader());

-- Approval logs: read-only projection of the shared approval history
CREATE VIEW public.approval_logs WITH (security_invoker = true) AS
  SELECT id, module, record_id, stage, level, action, actor_id, actor_name, signature, note, created_at FROM public.finance_approvals;
GRANT SELECT ON public.approval_logs TO authenticated;
CREATE POLICY approvals_proc_read ON public.finance_approvals FOR SELECT TO authenticated USING (public.procurement_reader());

-- Workflow RPC for orders, goods receipt and contracts
CREATE OR REPLACE FUNCTION public.procurement_action(_module text, _id uuid, _action text, _note text DEFAULT NULL, _date date DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid(); actor text; entry jsonb; lvl text; nstatus text;
  po public.purchase_orders; g public.goods_received_notes; c public.contracts; req public.procurement_funding; it public.purchase_order_items;
  l jsonb; acc int; rej int; total_value numeric := 0; delivered int := 0; accepted int := 0; rejected int := 0; n int; late int; lowest uuid; outstanding int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('lnpats.proc_rpc','on',true);
  SELECT coalesce(nullif(full_name,''),email) INTO actor FROM public.profiles WHERE id=uid;
  entry := jsonb_build_object('action',_action,'by',actor,'at',now(),'note',_note);

  IF _module='purchase_orders' THEN
    SELECT * INTO po FROM public.purchase_orders WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF _action='approve' AND po.status='Draft' AND public.has_any_role(uid, ARRAY['procurement_admin','commandant']::public.app_role[]) THEN
      IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE po_id=_id) THEN RAISE EXCEPTION 'Add at least one item before approval'; END IF;
      nstatus:='Approved'; lvl:='Procurement Administrator';
    ELSIF _action='send' AND po.status='Approved' AND public.procurement_staff() THEN nstatus:='Sent'; lvl:='Procurement Officer';
    ELSIF _action='cancel' AND po.status IN ('Draft','Approved','Sent') AND public.has_any_role(uid, ARRAY['procurement_admin']::public.app_role[]) THEN
      IF EXISTS (SELECT 1 FROM public.goods_received_notes WHERE po_id=_id AND status='Approved') THEN RAISE EXCEPTION 'Orders with received goods cannot be cancelled'; END IF;
      IF coalesce(trim(_note),'')='' THEN RAISE EXCEPTION 'A reason is required to cancel'; END IF;
      nstatus:='Cancelled'; lvl:='Procurement Administrator';
    ELSE RAISE EXCEPTION 'Not authorised for this purchase order action'; END IF;
    UPDATE public.purchase_orders SET status=nstatus, history=history||entry WHERE id=_id;
    IF nstatus='Cancelled' THEN UPDATE public.procurement_funding SET purchase_order_id=NULL WHERE purchase_order_id=_id; END IF;

  ELSIF _module='goods_received_notes' THEN
    SELECT * INTO g FROM public.goods_received_notes WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF g.status<>'Pending' THEN RAISE EXCEPTION 'This GRN has already been decided'; END IF;
    IF _action='reject' AND (public.procurement_staff() OR public.has_role(uid,'storekeeper')) THEN
      IF coalesce(trim(_note),'')='' THEN RAISE EXCEPTION 'A reason is required to reject'; END IF;
      UPDATE public.goods_received_notes SET status='Rejected', history=history||entry WHERE id=_id; lvl:='Stores';
    ELSIF _action='approve' AND public.has_role(uid,'storekeeper') THEN
      lvl:='Storekeeper';
      SELECT * INTO po FROM public.purchase_orders WHERE id=g.po_id FOR UPDATE;
      IF po.status NOT IN ('Approved','Sent','Partially Delivered') THEN RAISE EXCEPTION 'Purchase order is not open for delivery'; END IF;
      SELECT * INTO req FROM public.procurement_funding WHERE id=po.procurement_request_id;
      FOR l IN SELECT value FROM jsonb_array_elements(g.lines) LOOP
        SELECT * INTO it FROM public.purchase_order_items WHERE id=(l->>'po_item_id')::uuid AND po_id=po.id FOR UPDATE;
        acc := (l->>'accepted')::int; rej := (l->>'rejected')::int;
        IF acc > it.quantity - it.quantity_received THEN RAISE EXCEPTION 'Accepted quantity for "%" exceeds what is outstanding (%)', it.description, it.quantity - it.quantity_received; END IF;
        UPDATE public.purchase_order_items SET quantity_received=quantity_received+acc, quantity_rejected=quantity_rejected+rej WHERE id=it.id;
        delivered := delivered + acc + rej; accepted := accepted + acc; rejected := rejected + rej;
        total_value := total_value + acc * it.unit_price;
        IF acc > 0 AND it.inventory_item_id IS NOT NULL THEN
          INSERT INTO public.store_receipts(receipt_date, supplier_id, purchase_order_id, item_id, quantity, warehouse_id, remarks)
          VALUES (g.delivery_date, po.vendor_id, po.id, it.inventory_item_id, acc, g.warehouse_id, 'Received on '||g.grn_number);
        ELSIF acc > 0 AND it.is_asset THEN
          FOR n IN 1..acc LOOP
            INSERT INTO public.assets(asset_number, asset_name, category, condition, purchase_date, value)
            VALUES (g.grn_number||'-'||left(it.id::text,8)||'-'||n, it.description, coalesce(it.asset_category,'Equipment'), 'New', g.delivery_date, it.unit_price);
          END LOOP;
        END IF;
      END LOOP;
      IF total_value > 0 THEN
        INSERT INTO public.expenses(expense_date, description, amount, expense_type, section_id, vendor_id, budget_id)
        VALUES (g.delivery_date, 'Goods received '||g.grn_number||' on '||po.po_number, total_value, 'Procurement', req.section_id, po.vendor_id, req.budget_id);
      END IF;
      SELECT count(*) INTO outstanding FROM public.purchase_order_items WHERE po_id=po.id AND quantity_received < quantity;
      UPDATE public.purchase_orders SET status=CASE WHEN outstanding=0 THEN 'Completed' ELSE 'Partially Delivered' END, history=history||jsonb_build_object('action','delivery','by',actor,'at',now(),'note',g.grn_number) WHERE id=po.id;
      UPDATE public.goods_received_notes SET status='Approved', approved_by=uid, approved_at=now(), history=history||entry WHERE id=_id;
      late := CASE WHEN po.delivery_date IS NULL THEN 0 ELSE greatest(g.delivery_date - po.delivery_date, 0) END;
      SELECT lowest_quotation_id INTO lowest FROM public.quotation_comparisons WHERE request_id=po.procurement_request_id;
      INSERT INTO public.supplier_performance(vendor_id, po_id, grn_id, timeliness, quality, pricing, compliance, rated_by, remarks)
      VALUES (po.vendor_id, po.id, g.id,
        greatest(1, 5 - late/7.0)::numeric(3,1),
        CASE WHEN delivered=0 THEN NULL ELSE (1 + 4.0*accepted/delivered)::numeric(3,1) END,
        CASE WHEN po.quotation_id IS NULL OR lowest IS NULL THEN NULL WHEN po.quotation_id=lowest THEN 5 ELSE 3 END,
        CASE WHEN rejected=0 AND late=0 THEN 5 WHEN rejected=0 OR late=0 THEN 4 ELSE 2.5 END,
        uid, 'Automatic score from '||g.grn_number);
    ELSE RAISE EXCEPTION 'Only stores staff can approve goods received'; END IF;

  ELSIF _module='contracts' THEN
    SELECT * INTO c FROM public.contracts WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF NOT public.procurement_staff() OR c.status<>'Active' THEN RAISE EXCEPTION 'Not authorised for this contract action'; END IF;
    lvl:='Procurement';
    IF _action='renew' THEN
      IF _date IS NULL OR _date <= c.end_date THEN RAISE EXCEPTION 'The new end date must be after the current end date'; END IF;
      entry := entry || jsonb_build_object('previous_end', c.end_date, 'new_end', _date);
      UPDATE public.contracts SET end_date=_date, renewal_count=renewal_count+1, history=history||entry WHERE id=_id;
    ELSIF _action='terminate' THEN
      IF coalesce(trim(_note),'')='' THEN RAISE EXCEPTION 'A reason is required to terminate'; END IF;
      UPDATE public.contracts SET status='Terminated', history=history||entry WHERE id=_id;
    ELSE RAISE EXCEPTION 'Invalid contract action'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown module';
  END IF;

  INSERT INTO public.finance_approvals(module,record_id,level,action,actor_id,actor_name,signature,note)
  VALUES(_module,_id,lvl,_action,uid,actor,CASE WHEN _action IN ('approve','renew') THEN actor END,_note);
  PERFORM set_config('lnpats.proc_rpc','off',true);
END $$;
REVOKE ALL ON FUNCTION public.procurement_action(text,uuid,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procurement_action(text,uuid,text,text,date) TO authenticated;

-- Attachments for procurement records
CREATE POLICY procurement_storage_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='phase2-files' AND (
  EXISTS (SELECT 1 FROM public.quotations q CROSS JOIN LATERAL jsonb_array_elements(q.attachments) f(value) WHERE f.value->>'path' = objects.name)
  OR EXISTS (SELECT 1 FROM public.goods_received_notes g CROSS JOIN LATERAL jsonb_array_elements(g.attachments) f(value) WHERE f.value->>'path' = objects.name)
  OR EXISTS (SELECT 1 FROM public.contracts c CROSS JOIN LATERAL jsonb_array_elements(c.attachments) f(value) WHERE f.value->>'path' = objects.name)));

-- Procurement administrators act at the procurement level; procurement files can be opened by readers
DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.finance_workflow(text,uuid,text,text,numeric)'::regprocedure);
  n := replace(d, $r$public.has_role(uid,'procurement_officer')$r$, $r$public.has_any_role(uid, ARRAY['procurement_officer','procurement_admin']::public.app_role[])$r$);
  IF n = d THEN RAISE EXCEPTION 'finance_workflow procurement check not found'; END IF;
  EXECUTE n;
  d := pg_get_functiondef('public.record_activity(text,uuid,text)'::regprocedure);
  n := replace(d, $r$ END IF; IF NOT allowed THEN$r$, $r$ ELSIF _module IN ('quotations','goods_received_notes','contracts') THEN allowed:=public.procurement_reader(); END IF; IF NOT allowed THEN$r$);
  IF n = d THEN RAISE EXCEPTION 'record_activity branch not found'; END IF;
  EXECUTE n;
END $do$;

-- Audit every procurement table
CREATE TRIGGER audit_request_items AFTER INSERT OR UPDATE OR DELETE ON public.request_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_quotations AFTER INSERT OR UPDATE OR DELETE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_quotation_comparisons AFTER INSERT OR UPDATE OR DELETE ON public.quotation_comparisons FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_purchase_order_items AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_goods_received_notes AFTER INSERT OR UPDATE OR DELETE ON public.goods_received_notes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_supplier_performance AFTER INSERT OR UPDATE OR DELETE ON public.supplier_performance FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_procurement_reports AFTER INSERT ON public.procurement_reports FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE POLICY procurement_audit_read ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'procurement_admin') AND table_name IN ('vendors','procurement_funding','request_items','quotations','quotation_comparisons','purchase_orders','purchase_order_items','goods_received_notes','contracts','supplier_performance','procurement_reports'));