CREATE SEQUENCE public.ict_number_seq;
CREATE FUNCTION public.ict_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(),ARRAY['ict_admin']::public.app_role[]) $$;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS subject text, ADD COLUMN IF NOT EXISTS requester_name text, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.offices(id), ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS resolved_at timestamptz, ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS ict_managed boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS serial_number text, ADD COLUMN IF NOT EXISTS brand text, ADD COLUMN IF NOT EXISTS model text, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.offices(id), ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id), ADD COLUMN IF NOT EXISTS warranty_expiry date, ADD COLUMN IF NOT EXISTS asset_status text NOT NULL DEFAULT 'Active';
ALTER TABLE public.asset_maintenance ADD COLUMN IF NOT EXISTS maintenance_number text, ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Scheduled', ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.officers(id), ADD COLUMN IF NOT EXISTS findings text, ADD COLUMN IF NOT EXISTS action_taken text;
CREATE TABLE public.ict_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, number text NOT NULL UNIQUE DEFAULT ('ICT-'||lpad(nextval('public.ict_number_seq')::text,6,'0')), title text NOT NULL, category text NOT NULL, priority text NOT NULL DEFAULT 'Medium', status text NOT NULL DEFAULT 'Open', officer_id uuid REFERENCES public.officers(id), technician_id uuid REFERENCES public.officers(id), created_by uuid NOT NULL DEFAULT auth.uid(), details jsonb NOT NULL DEFAULT '{}', attachments jsonb NOT NULL DEFAULT '[]', history jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ict_kind CHECK(kind IN ('requests','incidents','network','accounts','knowledge')));
GRANT SELECT ON public.ict_records TO authenticated; GRANT ALL ON public.ict_records TO service_role;
ALTER TABLE public.ict_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY ict_record_read ON public.ict_records FOR SELECT TO authenticated USING(public.ict_staff() OR created_by=auth.uid() OR (kind='requests' AND public.hr_head(officer_id)) OR (kind='knowledge' AND status='Published') OR (kind<>'accounts' AND public.has_any_role(auth.uid(),ARRAY['commandant']::public.app_role[])));
CREATE TRIGGER audit_ict_records AFTER INSERT OR UPDATE OR DELETE ON public.ict_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE POLICY ict_ticket_read ON public.tickets FOR SELECT TO authenticated USING(public.ict_staff() OR created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.officers WHERE id=tickets.reported_by AND user_id=auth.uid()));
CREATE POLICY ict_asset_read ON public.assets FOR SELECT TO authenticated USING(ict_managed AND (public.ict_staff() OR EXISTS(SELECT 1 FROM public.officers WHERE id=assets.assigned_to AND user_id=auth.uid())));
CREATE POLICY ict_maintenance_read ON public.asset_maintenance FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.assets a WHERE a.id=asset_id AND a.ict_managed AND public.ict_staff()));
CREATE POLICY ict_assignment_read ON public.asset_assignments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.assets a WHERE a.id=asset_id AND a.ict_managed AND public.ict_staff()));
CREATE POLICY ict_transfer_read ON public.asset_transfers FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.assets a WHERE a.id=asset_id AND a.ict_managed AND public.ict_staff()));
CREATE FUNCTION public.ict_file_access(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM ict_records r WHERE r.attachments @> jsonb_build_array(jsonb_build_object('path',_path)) AND (ict_staff() OR r.created_by=auth.uid() OR (r.kind='knowledge' AND r.status='Published'))) $$;
CREATE POLICY ict_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='ict-files' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY ict_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='ict-files' AND public.ict_file_access(name));
CREATE FUNCTION public.ict_action(_module text,_id uuid,_action text,_payload jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); staff boolean:=public.ict_staff(); o uuid; tech uuid; r public.ict_records; t public.tickets; a public.assets; m public.asset_maintenance; v jsonb:=coalesce(_payload,'{}'); ev jsonb; newstatus text; own boolean; n text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT id INTO o FROM officers WHERE user_id=u LIMIT 1;
 ev:=jsonb_build_array(jsonb_build_object('action',_action,'actor',u,'at',now(),'note',v->>'note'));
 IF _module='tickets' THEN
  IF _action='create' THEN
   IF nullif(trim(v->>'subject'),'') IS NULL OR nullif(trim(v->>'description'),'') IS NULL OR nullif(v->>'category','') IS NULL THEN RAISE EXCEPTION 'Subject, category and description required'; END IF;
   IF coalesce(v->>'priority','Medium') NOT IN ('Low','Medium','High','Critical') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
   INSERT INTO tickets(ticket_number,reported_by,issue_type,priority,description,status,created_by,subject,requester_name,department_id,phone,email,history) VALUES('ICT-TKT-'||lpad(nextval('ict_number_seq')::text,6,'0'),o,v->>'category',coalesce(v->>'priority','Medium'),v->>'description','Open',u,v->>'subject',coalesce(nullif(v->>'requester_name',''),(SELECT full_name FROM officers WHERE id=o),'Staff'),nullif(v->>'department_id','')::uuid,v->>'phone',v->>'email',ev) RETURNING id INTO _id;
  ELSE
   SELECT * INTO t FROM tickets WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
   own:=t.created_by=u OR EXISTS(SELECT 1 FROM officers WHERE id=t.reported_by AND user_id=u);
   IF NOT staff AND NOT (own AND _action IN ('note','close','reopen')) THEN RAISE EXCEPTION 'ICT authority required'; END IF;
   IF _action='note' THEN IF nullif(trim(v->>'note'),'') IS NULL THEN RAISE EXCEPTION 'Note required'; END IF; newstatus:=t.status;
   ELSIF _action='assign' THEN tech:=nullif(v->>'technician_id','')::uuid; IF NOT EXISTS(SELECT 1 FROM officers x JOIN user_roles ur ON ur.user_id=x.user_id WHERE x.id=tech AND ur.role IN ('ict_admin','system_admin')) THEN RAISE EXCEPTION 'Select an ICT technician'; END IF; newstatus:='Assigned';
   ELSIF _action='close' THEN IF t.status<>'Resolved' THEN RAISE EXCEPTION 'Resolve ticket before closing'; END IF; newstatus:='Closed';
   ELSIF _action='reopen' THEN IF t.status NOT IN ('Resolved','Closed') THEN RAISE EXCEPTION 'Only resolved or closed tickets can reopen'; END IF; newstatus:='Open';
   ELSIF _action='status' THEN newstatus:=v->>'status'; IF t.status='Closed' OR newstatus NOT IN ('In Progress','Pending','Resolved') THEN RAISE EXCEPTION 'Invalid ticket transition'; END IF; IF newstatus='Resolved' AND nullif(trim(v->>'note'),'') IS NULL THEN RAISE EXCEPTION 'Resolution note required'; END IF;
   ELSE RAISE EXCEPTION 'Unknown ticket action'; END IF;
   UPDATE tickets SET status=newstatus,assigned_to=CASE WHEN _action='assign' THEN tech ELSE assigned_to END,resolved_at=CASE WHEN newstatus='Resolved' THEN now() WHEN _action='reopen' THEN NULL ELSE resolved_at END,history=history||ev WHERE id=_id;
  END IF;
 ELSIF _module='assets' THEN
  IF NOT staff THEN RAISE EXCEPTION 'ICT authority required'; END IF;
  IF _action='create' THEN
   IF nullif(trim(v->>'asset_name'),'') IS NULL OR v->>'category' NOT IN ('Desktop Computers','Laptops','Printers','Scanners','Routers','Switches','Servers','CCTV Equipment','UPS Devices','Projectors') THEN RAISE EXCEPTION 'Asset name and valid type required'; END IF;
   INSERT INTO assets(asset_number,asset_name,category,ict_managed,serial_number,brand,model,department_id,purchase_date,warranty_expiry,condition) VALUES('ICT-AST-'||lpad(nextval('ict_number_seq')::text,6,'0'),v->>'asset_name',v->>'category',true,v->>'serial_number',v->>'brand',v->>'model',nullif(v->>'department_id','')::uuid,nullif(v->>'purchase_date','')::date,nullif(v->>'warranty_expiry','')::date,'Good') RETURNING id INTO _id;
  ELSE
   SELECT * INTO a FROM assets WHERE id=_id AND ict_managed FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'ICT asset not found'; END IF;
   IF _action='retire' THEN UPDATE asset_assignments SET returned_date=current_date WHERE asset_id=_id AND returned_date IS NULL; UPDATE assets SET asset_status='Retired',assigned_to=NULL WHERE id=_id;
   ELSIF _action IN ('assign','transfer') THEN
    IF a.asset_status='Retired' THEN RAISE EXCEPTION 'Retired assets cannot be assigned'; END IF;
    tech:=nullif(v->>'officer_id','')::uuid; IF tech IS NULL THEN RAISE EXCEPTION 'Assigned user required'; END IF;
    IF _action='transfer' AND nullif(trim(v->>'note'),'') IS NULL THEN RAISE EXCEPTION 'Transfer reason required'; END IF;
    UPDATE asset_assignments SET returned_date=current_date WHERE asset_id=_id AND returned_date IS NULL;
    INSERT INTO asset_assignments(asset_id,officer_id,section_id,assigned_by,remarks) VALUES(_id,tech,nullif(v->>'section_id','')::uuid,u,v->>'note');
    IF _action='transfer' THEN INSERT INTO asset_transfers(asset_id,from_officer_id,to_officer_id,from_section_id,to_section_id,recorded_by,reason) VALUES(_id,a.assigned_to,tech,a.section_id,nullif(v->>'section_id','')::uuid,u,v->>'note'); END IF;
    UPDATE assets SET assigned_to=tech,section_id=nullif(v->>'section_id','')::uuid,department_id=(SELECT office_id FROM sections WHERE id=nullif(v->>'section_id','')::uuid) WHERE id=_id;
   ELSE RAISE EXCEPTION 'Unknown asset action'; END IF;
  END IF;
 ELSIF _module='maintenance' THEN
  IF NOT staff THEN RAISE EXCEPTION 'ICT authority required'; END IF;
  IF _action='create' THEN
   IF NOT EXISTS(SELECT 1 FROM assets WHERE id=nullif(v->>'asset_id','')::uuid AND ict_managed) OR nullif(v->>'maintenance_date','') IS NULL OR v->>'maintenance_type' NOT IN ('Preventive','Corrective') THEN RAISE EXCEPTION 'ICT asset, date and maintenance type required'; END IF;
   INSERT INTO asset_maintenance(asset_id,maintenance_number,maintenance_date,maintenance_type,technician_id,description,recorded_by) VALUES((v->>'asset_id')::uuid,'ICT-MNT-'||lpad(nextval('ict_number_seq')::text,6,'0'),(v->>'maintenance_date')::date,v->>'maintenance_type',nullif(v->>'technician_id','')::uuid,v->>'description',u) RETURNING id INTO _id;
  ELSIF _action='complete' THEN
   SELECT * INTO m FROM asset_maintenance WHERE id=_id FOR UPDATE;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM assets WHERE id=m.asset_id AND ict_managed) OR m.status='Completed' THEN RAISE EXCEPTION 'Scheduled ICT maintenance required'; END IF;
   IF nullif(trim(v->>'findings'),'') IS NULL OR nullif(trim(v->>'action_taken'),'') IS NULL THEN RAISE EXCEPTION 'Findings and action taken required'; END IF;
   UPDATE asset_maintenance SET findings=v->>'findings',action_taken=v->>'action_taken',status='Completed' WHERE id=_id;
  ELSE RAISE EXCEPTION 'Unknown maintenance action'; END IF;
 ELSIF _module IN ('requests','incidents','network','accounts','knowledge') THEN
  IF _action='create' THEN
   IF NOT staff AND _module<>'requests' THEN RAISE EXCEPTION 'ICT authority required'; END IF;
   IF nullif(trim(v->>'title'),'') IS NULL OR nullif(trim(v->>'category'),'') IS NULL THEN RAISE EXCEPTION 'Title and category required'; END IF;
   IF coalesce(v->>'priority','Medium') NOT IN ('Low','Medium','High','Critical') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
   IF _module='requests' AND (o IS NULL OR nullif(trim(v->>'description'),'') IS NULL) THEN RAISE EXCEPTION 'Linked employee and request description required'; END IF;
   IF _module='accounts' AND (v ? 'password' OR v ? 'secret') THEN RAISE EXCEPTION 'Never store passwords'; END IF;
   FOR n IN SELECT x->>'path' FROM jsonb_array_elements(coalesce(v->'attachments','[]')) x LOOP
    IF split_part(n,'/',1)<>u::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ict-files' AND name=n) THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
   END LOOP;
   INSERT INTO ict_records(kind,title,category,priority,status,officer_id,details,attachments,history) VALUES(_module,v->>'title',v->>'category',coalesce(v->>'priority','Medium'),CASE _module WHEN 'requests' THEN 'Pending Supervisor' WHEN 'network' THEN 'Unknown' WHEN 'accounts' THEN 'Registered' WHEN 'knowledge' THEN 'Draft' ELSE 'Open' END,o,v-ARRAY['attachments','password','secret'],coalesce(v->'attachments','[]'),ev) RETURNING id INTO _id;
  ELSE
   SELECT * INTO r FROM ict_records WHERE id=_id AND kind=_module FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
   IF _module='requests' AND _action IN ('approve','reject') THEN
    IF r.status<>'Pending Supervisor' OR NOT (public.hr_head(r.officer_id) OR EXISTS(SELECT 1 FROM officers x JOIN officers supervisor ON supervisor.id=x.supervisor_id WHERE x.id=r.officer_id AND supervisor.user_id=u) OR public.has_any_role(u,ARRAY['system_admin']::app_role[])) THEN RAISE EXCEPTION 'Supervisor authority required'; END IF;
    newstatus:=CASE WHEN _action='approve' THEN 'Pending ICT' ELSE 'Rejected' END;
   ELSE
    IF NOT staff THEN RAISE EXCEPTION 'ICT authority required'; END IF;
    IF _module='requests' THEN
     IF _action='assign' AND r.status IN ('Pending ICT','Assigned') THEN
      tech:=nullif(v->>'technician_id','')::uuid; IF NOT EXISTS(SELECT 1 FROM officers x JOIN user_roles ur ON ur.user_id=x.user_id WHERE x.id=tech AND ur.role IN ('ict_admin','system_admin')) THEN RAISE EXCEPTION 'Select an ICT technician'; END IF; newstatus:='Assigned';
     ELSIF _action='complete' AND r.status='Assigned' AND nullif(trim(v->>'note'),'') IS NOT NULL THEN newstatus:='Completed'; ELSE RAISE EXCEPTION 'Approve and assign request before completing with report'; END IF;
    ELSIF _module='incidents' THEN
     IF _action='escalate' AND r.status<>'Closed' THEN newstatus:='Escalated'; ELSIF _action='close' AND r.status<>'Closed' AND nullif(trim(v->>'root_cause'),'') IS NOT NULL AND nullif(trim(v->>'resolution'),'') IS NOT NULL THEN newstatus:='Closed'; ELSE RAISE EXCEPTION 'Root cause and resolution required to close incident'; END IF;
    ELSIF _module='knowledge' THEN IF _action='publish' AND r.status='Draft' THEN newstatus:='Published'; ELSE RAISE EXCEPTION 'Draft article required'; END IF;
    ELSIF _module='network' THEN IF _action<>'check_in' OR v->>'status' NOT IN ('Online','Offline','Degraded','Unknown') THEN RAISE EXCEPTION 'Valid network check-in required'; END IF; newstatus:=v->>'status'; v:=v||jsonb_build_object('last_check_in',now());
    ELSIF _module='accounts' THEN IF _action NOT IN ('disable','reset_request','unlock_request','activate','login_event') THEN RAISE EXCEPTION 'Unknown account action'; END IF; newstatus:=CASE _action WHEN 'disable' THEN 'Disabled' WHEN 'activate' THEN 'Active' ELSE r.status END;
    END IF;
   END IF;
   UPDATE ict_records SET status=newstatus,technician_id=CASE WHEN _action='assign' THEN tech ELSE technician_id END,priority=CASE WHEN _action='escalate' THEN 'Critical' ELSE priority END,details=details||(v-ARRAY['password','secret','technician_id']),history=history||ev,updated_at=now() WHERE id=_id;
  END IF;
 ELSE RAISE EXCEPTION 'Unknown ICT module'; END IF;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.ict_action(text,uuid,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ict_action(text,uuid,text,jsonb) TO authenticated;
GRANT SELECT ON public.tickets,public.assets,public.asset_maintenance,public.asset_assignments,public.asset_transfers TO authenticated;