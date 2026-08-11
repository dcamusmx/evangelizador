ALTER TABLE public.contenido_diario
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS storage_filename text,
  ADD COLUMN IF NOT EXISTS storage_size bigint,
  ADD COLUMN IF NOT EXISTS storage_content_type text,
  ADD COLUMN IF NOT EXISTS storage_etag text,
  ADD COLUMN IF NOT EXISTS storage_uploaded_at timestamptz;