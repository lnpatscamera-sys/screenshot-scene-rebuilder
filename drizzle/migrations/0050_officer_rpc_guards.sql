DO $$ DECLARE fn record; definition text; guarded text; BEGIN
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('hr_action','act_on_leave','act_on_supply') LOOP
 definition:=pg_get_functiondef(fn.oid);
 IF position('BEGIN' in definition)=0 THEN RAISE EXCEPTION 'Missing guard insertion point for %',fn.proname; END IF;
 guarded:=replace(definition,'BEGIN','BEGIN IF public.officer_personal_only() THEN RAISE EXCEPTION ''Access Denied''; END IF;');
 EXECUTE guarded;
 END LOOP;
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('command_report_reader','command_supply_reader','can_read_document','command_chain','daily_report_action','command_supply_action','ict_action','command_report_summary','compile_daily_reports','facility_action','phase2_workflow','command_supply_evidence') LOOP
 IF position('officer_personal_only' in pg_get_functiondef(fn.oid))=0 THEN RAISE EXCEPTION 'Officer guard missing in %',fn.proname; END IF;
 END LOOP;
END $$;