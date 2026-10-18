CREATE OR REPLACE FUNCTION public.prepare_stock_posting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE stock public.inventory_items; req public.supply_requests; actor uuid; delta integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid(),ARRAY['storekeeper']::public.app_role[]) THEN RAISE EXCEPTION 'Only stores staff can post stock'; END IF;
 IF NEW.item_id IS NULL THEN RAISE EXCEPTION 'An inventory item is required'; END IF;
 IF TG_TABLE_NAME='store_issues' THEN
  IF NEW.request_id IS NOT NULL THEN
   SELECT * INTO req FROM public.supply_requests WHERE id=NEW.request_id FOR UPDATE;
   IF NOT FOUND OR req.stage<>8 OR req.collection_status<>'Collected' OR req.approval_status<>'Approved' OR req.item_id IS DISTINCT FROM NEW.item_id OR req.quantity IS DISTINCT FROM NEW.quantity THEN RAISE EXCEPTION 'Supply issues must match an approved collection'; END IF;
  END IF;
 END IF;
 SELECT * INTO stock FROM public.inventory_items WHERE id=NEW.item_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
 NEW.balance_before := stock.quantity;
 SELECT id INTO actor FROM public.officers WHERE user_id=auth.uid() ORDER BY id LIMIT 1;
 IF TG_TABLE_NAME='stock_reconciliation' THEN
  IF NEW.counted_quantity IS NULL OR NEW.counted_quantity<0 THEN RAISE EXCEPTION 'Counted quantity must be zero or greater'; END IF;
  NEW.system_quantity := stock.quantity; NEW.counted_by := actor; NEW.balance_after := NEW.counted_quantity;
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