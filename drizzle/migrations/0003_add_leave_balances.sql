CREATE TABLE public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID REFERENCES public.officers(id),
    year INTEGER,
    annual_leave_allocated INTEGER DEFAULT 30,
    annual_leave_used INTEGER DEFAULT 0,
    annual_leave_balance INTEGER DEFAULT 30,
    sick_leave_used INTEGER DEFAULT 0,
    emergency_leave_used INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_balances_admin_only ON public.leave_balances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'system_admin')) WITH CHECK (public.has_role(auth.uid(), 'system_admin'));
CREATE TRIGGER audit_leave_balances AFTER INSERT OR UPDATE OR DELETE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
COMMENT ON TABLE public.leave_balances IS 'Staged officer leave balance records; system-admin-only until leave balance integration and module permissions are implemented. Existing approved leave requests remain canonical for workflow usage.';