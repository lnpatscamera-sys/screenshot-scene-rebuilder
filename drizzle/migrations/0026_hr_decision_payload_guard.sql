DO $$ DECLARE src text; BEGIN SELECT pg_get_functiondef('public.hr_action(text,uuid,text,jsonb)'::regprocedure) INTO src;
src:=replace(src,'FROM jsonb_object_keys(_payload) k WHERE k NOT IN','FROM jsonb_object_keys(_payload) AS payload_keys(key) WHERE payload_keys.key NOT IN');
src:=replace(src,'IF _action NOT IN (''create'',''edit'') AND EXISTS','IF _action NOT IN (''create'',''edit'') AND _module<>''attendance'' AND EXISTS');
EXECUTE src; END $$;