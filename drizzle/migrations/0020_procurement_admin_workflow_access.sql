DO $migration$
DECLARE definition text; updated text;
BEGIN
  definition := pg_get_functiondef('public.finance_workflow(text,uuid,text,text,numeric)'::regprocedure);
  updated := replace(replace(definition, $old$public.has_role(uid,'commandant')$old$, $new$public.has_any_role(uid, ARRAY['commandant']::public.app_role[])$new$), $old$public.has_role(uid,'ict_admin')$old$, $new$public.has_any_role(uid, ARRAY['ict_admin']::public.app_role[])$new$);
  IF definition = updated THEN RAISE EXCEPTION 'Expected finance approval checks not found'; END IF;
  EXECUTE updated;
  definition := pg_get_functiondef('public.procurement_action(text,uuid,text,text,date)'::regprocedure);
  updated := replace(definition, $old$public.has_role(uid,'storekeeper')$old$, $new$public.has_any_role(uid, ARRAY['storekeeper']::public.app_role[])$new$);
  IF definition = updated THEN RAISE EXCEPTION 'Expected stores approval checks not found'; END IF;
  EXECUTE updated;
END $migration$;
REVOKE ALL ON FUNCTION public.finance_workflow(text,uuid,text,text,numeric), public.procurement_action(text,uuid,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_workflow(text,uuid,text,text,numeric), public.procurement_action(text,uuid,text,text,date) TO authenticated;