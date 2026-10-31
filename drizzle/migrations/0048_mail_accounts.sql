CREATE TABLE public.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  secret text NOT NULL,
  host text NOT NULL DEFAULT 'lnpats.net',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT ALL ON public.mail_accounts TO service_role;
ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own mailbox only" ON public.mail_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER audit_mail_accounts AFTER INSERT OR UPDATE OR DELETE ON public.mail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();