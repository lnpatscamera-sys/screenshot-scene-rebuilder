ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS lnp_class_number text;
CREATE UNIQUE INDEX IF NOT EXISTS officers_service_number_lower_uq ON public.officers (lower(service_number));