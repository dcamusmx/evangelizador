CREATE TABLE IF NOT EXISTS public.evangelios (
  fecha date PRIMARY KEY,
  santo_o_tiempo_liturgico text,
  cita_evangelio text,
  titulo text,
  descripcion_base text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.evangelios TO authenticated;
GRANT ALL ON public.evangelios TO service_role;
ALTER TABLE public.evangelios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evangelios_fecha_desc ON public.evangelios (fecha DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evangelios_updated_at
BEFORE UPDATE ON public.evangelios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "evangelios_select_staff"
ON public.evangelios FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "evangelios_insert_staff"
ON public.evangelios FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "evangelios_update_staff"
ON public.evangelios FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));
