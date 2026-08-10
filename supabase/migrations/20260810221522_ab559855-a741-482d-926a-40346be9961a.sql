CREATE TABLE public.credenciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  valor_cifrado text NOT NULL,
  pista text,
  activo boolean NOT NULL DEFAULT true,
  actualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servicio, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credenciales TO service_role;

ALTER TABLE public.credenciales ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_credenciales_updated_at
BEFORE UPDATE ON public.credenciales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();