-- lovable-cron-fallback-reviewed: offline device alerts are time-based (absence of events); runs every 10 minutes, 144 runs/day
CREATE FUNCTION public.attendance_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(),ARRAY['hr_officer','hr_admin','system_admin']::app_role[]) $$;
REVOKE ALL ON FUNCTION public.attendance_staff() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.attendance_staff() TO authenticated;

CREATE TABLE public.attendance_devices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL, model text NOT NULL DEFAULT 'DS-K1T804BMF', ip_address text, port integer NOT NULL DEFAULT 80,
 location text, serial_number text, token_hash text NOT NULL,
 status text NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting','Online','Offline')),
 last_seen_at timestamptz, last_sync_at timestamptz, offline_alerted boolean NOT NULL DEFAULT false,
 created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.biometric_users(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 biometric_user_id text NOT NULL UNIQUE, officer_id uuid NOT NULL REFERENCES public.officers(id),
 created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(officer_id));
CREATE TABLE public.attendance_punches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 device_id uuid NOT NULL REFERENCES public.attendance_devices(id), officer_id uuid REFERENCES public.officers(id),
 biometric_user_id text, punched_at timestamptz NOT NULL, direction text NOT NULL DEFAULT 'Check In' CHECK (direction IN ('Check In','Check Out')),
 method text NOT NULL DEFAULT 'Fingerprint', event_key text NOT NULL UNIQUE, raw jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX attendance_punches_time ON public.attendance_punches(punched_at);
CREATE TABLE public.attendance_sync_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid REFERENCES public.attendance_devices(id),
 event text NOT NULL, detail text, ip_address text, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT,INSERT,UPDATE ON public.attendance_devices TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.biometric_users TO authenticated;
GRANT SELECT ON public.attendance_punches, public.attendance_sync_logs TO authenticated;
GRANT ALL ON public.attendance_devices, public.biometric_users, public.attendance_punches, public.attendance_sync_logs TO service_role;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR reads devices" ON public.attendance_devices FOR SELECT TO authenticated USING (public.attendance_staff());
CREATE POLICY "HR adds devices" ON public.attendance_devices FOR INSERT TO authenticated WITH CHECK (public.attendance_staff());
CREATE POLICY "HR edits devices" ON public.attendance_devices FOR UPDATE TO authenticated USING (public.attendance_staff()) WITH CHECK (public.attendance_staff());
CREATE POLICY "HR reads mapping" ON public.biometric_users FOR SELECT TO authenticated USING (public.attendance_staff());
CREATE POLICY "HR maps users" ON public.biometric_users FOR INSERT TO authenticated WITH CHECK (public.attendance_staff());
CREATE POLICY "HR unmaps users" ON public.biometric_users FOR DELETE TO authenticated USING (public.attendance_staff());
CREATE POLICY "HR reads punches" ON public.attendance_punches FOR SELECT TO authenticated USING (public.attendance_staff());
CREATE POLICY "HR reads sync log" ON public.attendance_sync_logs FOR SELECT TO authenticated USING (public.attendance_staff());

CREATE FUNCTION public.attendance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Attendance records are permanent and cannot be changed'; END $$;
CREATE TRIGGER attendance_punches_immutable BEFORE UPDATE OR DELETE ON public.attendance_punches FOR EACH ROW EXECUTE FUNCTION public.attendance_immutable();
CREATE TRIGGER attendance_logs_immutable BEFORE UPDATE OR DELETE ON public.attendance_sync_logs FOR EACH ROW EXECUTE FUNCTION public.attendance_immutable();
CREATE TRIGGER audit_attendance_devices AFTER INSERT OR UPDATE OR DELETE ON public.attendance_devices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_biometric_users AFTER INSERT OR UPDATE OR DELETE ON public.biometric_users FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_attendance_punches AFTER INSERT ON public.attendance_punches FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE FUNCTION public.attendance_alert(_title text,_body text,_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid; BEGIN FOR u IN SELECT DISTINCT user_id FROM user_roles WHERE role IN ('hr_officer','hr_admin') LOOP PERFORM command_notify(u,_title,_body,_key); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.attendance_alert(text,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.attendance_alert(text,text,text) TO service_role;

CREATE FUNCTION public.attendance_device_watch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d attendance_devices; BEGIN
 FOR d IN SELECT * FROM attendance_devices WHERE status='Online' AND last_seen_at < now()-interval '5 minutes' LOOP
  UPDATE attendance_devices SET status='Offline', offline_alerted=true WHERE id=d.id;
  INSERT INTO attendance_sync_logs(device_id,event,detail) VALUES(d.id,'Offline','No contact for 5 minutes');
  PERFORM attendance_alert('Attendance device offline', d.name||' has stopped sending data', d.id||':offline:'||to_char(now(),'YYYYMMDDHH24MI'));
 END LOOP; END $$;
REVOKE ALL ON FUNCTION public.attendance_device_watch() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('attendance-device-watch','*/10 * * * *','SELECT public.attendance_device_watch()');