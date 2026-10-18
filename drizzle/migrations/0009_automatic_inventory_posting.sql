ALTER TABLE public.store_receipts ADD COLUMN posted_at timestamptz, ADD COLUMN posted_by uuid REFERENCES public.profiles(id), ADD COLUMN balance_before integer, ADD COLUMN balance_after integer;
ALTER TABLE public.store_issues ADD COLUMN posted_at timestamptz, ADD COLUMN posted_by uuid REFERENCES public.profiles(id), ADD COLUMN balance_before integer, ADD COLUMN balance_after integer;
ALTER TABLE public.stock_reconciliation ADD COLUMN posted_at timestamptz, ADD COLUMN posted_by uuid REFERENCES public.profiles(id), ADD COLUMN balance_before integer, ADD COLUMN balance_after integer;
ALTER TABLE public.inventory_movements ADD COLUMN reconciliation_id uuid REFERENCES public.stock_reconciliation(id), ADD COLUMN balance_before integer, ADD COLUMN balance_after integer, ADD COLUMN actor_id uuid REFERENCES public.profiles(id);
CREATE UNIQUE INDEX inventory_movement_receipt_once ON public.inventory_movements(receipt_id) WHERE receipt_id IS NOT NULL;
CREATE UNIQUE INDEX inventory_movement_issue_once ON public.inventory_movements(issue_id) WHERE issue_id IS NOT NULL;
CREATE UNIQUE INDEX inventory_movement_reconciliation_once ON public.inventory_movements(reconciliation_id) WHERE reconciliation_id IS NOT NULL;
CREATE UNIQUE INDEX posted_supply_issue_once ON public.store_issues(request_id) WHERE request_id IS NOT NULL AND posted_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.prepare_stock_posting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE stock public.inventory_items; req public.supply_requests; actor uuid; delta integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid(),ARRAY['storekeeper']::public.app_role[]) THEN RAISE EXCEPTION 'Only stores staff can post stock'; END IF;
 IF NEW.item_id IS NULL THEN RAISE EXCEPTION 'An inventory item is required'; END IF;
 IF TG_TABLE_NAME='store_issues' AND NEW.request_id IS NOT NULL THEN
  SELECT * INTO req FROM public.supply_requests WHERE id=NEW.request_id FOR UPDATE;
  IF NOT FOUND OR req.stage<>8 OR req.collection_status<>'Collected' OR req.approval_status<>'Approved' OR req.item_id IS DISTINCT FROM NEW.item_id OR req.quantity IS DISTINCT FROM NEW.quantity THEN RAISE EXCEPTION 'Supply issues must match an approved collection'; END IF;
 END IF;
 SELECT * INTO stock FROM public.inventory_items WHERE id=NEW.item_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
 NEW.balance_before := stock.quantity;
 SELECT id INTO actor FROM public.officers WHERE user_id=auth.uid() ORDER BY id LIMIT 1;
 IF TG_TABLE_NAME='stock_reconciliation' THEN
  IF NEW.counted_quantity IS NULL OR NEW.counted_quantity<0 THEN RAISE EXCEPTION 'Counted quantity must be zero or greater'; END IF;
  NEW.system_quantity := stock.quantity;
  NEW.counted_by := actor;
  NEW.balance_after := NEW.counted_quantity;
 ELSE
  IF NEW.quantity IS NULL OR NEW.quantity<=0 THEN RAISE EXCEPTION 'Quantity must be a positive whole number'; END IF;
  IF NEW.unit IS NOT NULL AND NEW.unit<>stock.unit THEN RAISE EXCEPTION 'Unit must match the inventory item'; END IF;
  NEW.unit := stock.unit;
  delta := CASE WHEN TG_TABLE_NAME='store_receipts' THEN NEW.quantity ELSE -NEW.quantity END;
  NEW.balance_after := stock.quantity + delta;
  IF NEW.balance_after<0 THEN RAISE EXCEPTION 'Insufficient stock: % available',stock.quantity; END IF;
  IF TG_TABLE_NAME='store_receipts' THEN NEW.received_by := actor; ELSE NEW.issued_by := actor; END IF;
 END IF;
 NEW.posted_by := auth.uid(); NEW.posted_at := now();
 UPDATE public.inventory_items SET quantity=NEW.balance_after WHERE id=NEW.item_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prepare_stock_posting() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid;
BEGIN
 SELECT id INTO actor FROM public.officers WHERE user_id=NEW.posted_by ORDER BY id LIMIT 1;
 INSERT INTO public.inventory_movements(item_id,movement_type,quantity,receipt_id,issue_id,reconciliation_id,request_id,recorded_by,actor_id,remarks,balance_before,balance_after)
 VALUES(NEW.item_id,CASE TG_TABLE_NAME WHEN 'store_receipts' THEN 'Receipt' WHEN 'store_issues' THEN 'Issue' ELSE 'Reconciliation' END,NEW.balance_after-NEW.balance_before,
 CASE WHEN TG_TABLE_NAME='store_receipts' THEN NEW.id END,CASE WHEN TG_TABLE_NAME='store_issues' THEN NEW.id END,CASE WHEN TG_TABLE_NAME='stock_reconciliation' THEN NEW.id END,
 CASE WHEN TG_TABLE_NAME='store_issues' THEN (to_jsonb(NEW)->>'request_id')::uuid END,actor,NEW.posted_by,NEW.remarks,NEW.balance_before,NEW.balance_after);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_stock_movement() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.guard_posted_stock() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF OLD.posted_at IS NOT NULL THEN RAISE EXCEPTION 'Posted stock records cannot be edited or deleted; record a correcting entry'; END IF;
 RAISE EXCEPTION 'Legacy stock records are read-only; record a new entry';
END $$;
CREATE TRIGGER prepare_receipt BEFORE INSERT ON public.store_receipts FOR EACH ROW EXECUTE FUNCTION public.prepare_stock_posting();
CREATE TRIGGER record_receipt AFTER INSERT ON public.store_receipts FOR EACH ROW EXECUTE FUNCTION public.record_stock_movement();
CREATE TRIGGER guard_receipt BEFORE UPDATE OR DELETE ON public.store_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_posted_stock();
CREATE TRIGGER prepare_issue BEFORE INSERT ON public.store_issues FOR EACH ROW EXECUTE FUNCTION public.prepare_stock_posting();
CREATE TRIGGER record_issue AFTER INSERT ON public.store_issues FOR EACH ROW EXECUTE FUNCTION public.record_stock_movement();
CREATE TRIGGER guard_issue BEFORE UPDATE OR DELETE ON public.store_issues FOR EACH ROW EXECUTE FUNCTION public.guard_posted_stock();
CREATE TRIGGER prepare_reconciliation BEFORE INSERT ON public.stock_reconciliation FOR EACH ROW EXECUTE FUNCTION public.prepare_stock_posting();
CREATE TRIGGER record_reconciliation AFTER INSERT ON public.stock_reconciliation FOR EACH ROW EXECUTE FUNCTION public.record_stock_movement();
CREATE TRIGGER guard_reconciliation BEFORE UPDATE OR DELETE ON public.stock_reconciliation FOR EACH ROW EXECUTE FUNCTION public.guard_posted_stock();
REVOKE INSERT, UPDATE, DELETE ON public.store_receipts,public.store_issues,public.stock_reconciliation,public.inventory_movements FROM authenticated,anon;
GRANT SELECT, INSERT ON public.store_receipts,public.store_issues,public.stock_reconciliation TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
DROP POLICY logistics_admin_only ON public.store_receipts;
DROP POLICY logistics_admin_only ON public.store_issues;
DROP POLICY logistics_admin_only ON public.stock_reconciliation;
DROP POLICY logistics_admin_only ON public.inventory_movements;
CREATE POLICY stores_read ON public.store_receipts FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['storekeeper','commandant']::public.app_role[]));
CREATE POLICY stores_post ON public.store_receipts FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['storekeeper']::public.app_role[]) AND posted_by=auth.uid());
CREATE POLICY stores_read ON public.store_issues FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['storekeeper','commandant']::public.app_role[]));
CREATE POLICY stores_post ON public.store_issues FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['storekeeper']::public.app_role[]) AND posted_by=auth.uid() AND request_id IS NULL);
CREATE POLICY stores_read ON public.stock_reconciliation FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['storekeeper','commandant']::public.app_role[]));
CREATE POLICY stores_post ON public.stock_reconciliation FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['storekeeper']::public.app_role[]) AND posted_by=auth.uid());
CREATE POLICY stores_read ON public.inventory_movements FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['storekeeper','commandant']::public.app_role[]));
CREATE OR REPLACE FUNCTION public.act_on_supply(_id uuid,_approve boolean,_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.supply_requests; ns integer;
BEGIN
 SELECT * INTO r FROM public.supply_requests WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.approval_status='Rejected' OR r.stage>=8 THEN RAISE EXCEPTION 'Request already closed'; END IF;
 IF NOT public.has_any_role(auth.uid(),public.supply_stage_role(r.stage)) THEN RAISE EXCEPTION 'Not authorised for this stage'; END IF;
 IF NOT _approve AND r.stage>3 THEN RAISE EXCEPTION 'Cannot reject after approval'; END IF;
 ns := CASE WHEN _approve THEN r.stage+1 ELSE r.stage END;
 UPDATE public.supply_requests SET stage=ns,approval_status=CASE WHEN NOT _approve THEN 'Rejected' WHEN ns>=4 THEN 'Approved' ELSE 'Pending' END,
 collection_status=CASE WHEN ns=6 THEN 'Preparing' WHEN ns=7 THEN 'Ready for Collection' WHEN ns=8 THEN 'Collected' ELSE collection_status END,
 history=r.history||jsonb_build_object('stage',r.stage,'action',CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,'by',(SELECT email FROM public.profiles WHERE id=auth.uid()),'note',_note,'at',now()) WHERE id=_id;
 IF _approve AND r.stage=7 AND r.item_id IS NOT NULL THEN
  INSERT INTO public.store_issues(issue_number,request_id,item_id,quantity,section_id,remarks) VALUES('COLLECT-'||r.request_number,r.id,r.item_id,r.quantity,r.section_id,_note);
 END IF;
 IF r.requested_by IS NOT NULL THEN INSERT INTO public.notifications(user_id,title,body) VALUES(r.requested_by,'Request '||r.request_number,CASE WHEN NOT _approve THEN 'Your request was rejected.' WHEN ns=7 THEN 'Items are ready for collection at Logistics.' WHEN ns=8 THEN 'Collection confirmed.' ELSE 'Your request advanced to the next stage.' END); END IF;
 IF _approve AND ns<8 THEN INSERT INTO public.notifications(role,title,body) SELECT unnest(public.supply_stage_role(ns)),'Supply request '||r.request_number,'A supply request needs your action.'; END IF;
END $$;
COMMENT ON TABLE public.store_receipts IS 'New receipts atomically increase canonical inventory and generate immutable movement/audit records. Legacy rows are not reposted.';
COMMENT ON TABLE public.store_issues IS 'New issues atomically reduce stock. Supply collection creates one issue through act_on_supply; direct linked issue inserts are denied.';
COMMENT ON TABLE public.stock_reconciliation IS 'New counts replace stock under row lock and record the actual pre-count balance, signed variance, and audit trail.';
COMMENT ON TABLE public.inventory_movements IS 'Read-only generated stock postings with source, signed change, before/after balance, actor, and timestamp. Legacy and unrelated manual adjustments are not backfilled.';