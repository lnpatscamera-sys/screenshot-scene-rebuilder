CREATE OR REPLACE FUNCTION public.record_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; details jsonb;
BEGIN
 details := to_jsonb(NEW);
 SELECT id INTO actor FROM public.officers WHERE user_id=NEW.posted_by ORDER BY id LIMIT 1;
 INSERT INTO public.inventory_movements(item_id,movement_type,quantity,receipt_id,issue_id,reconciliation_id,request_id,recorded_by,actor_id,remarks,balance_before,balance_after)
 VALUES(NEW.item_id,CASE TG_TABLE_NAME WHEN 'store_receipts' THEN 'Receipt' WHEN 'store_issues' THEN 'Issue' ELSE 'Reconciliation' END,NEW.balance_after-NEW.balance_before,
 CASE WHEN TG_TABLE_NAME='store_receipts' THEN NEW.id END,CASE WHEN TG_TABLE_NAME='store_issues' THEN NEW.id END,CASE WHEN TG_TABLE_NAME='stock_reconciliation' THEN NEW.id END,
 CASE WHEN TG_TABLE_NAME='store_issues' THEN (details->>'request_id')::uuid END,actor,NEW.posted_by,coalesce(details->>'remarks',details->>'reason'),NEW.balance_before,NEW.balance_after);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_stock_movement() FROM PUBLIC,anon,authenticated;