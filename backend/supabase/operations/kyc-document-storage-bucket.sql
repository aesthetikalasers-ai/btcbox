-- BTCBOX private identity-document evidence bucket.
-- The backend uploads with the server-only service credential and creates
-- short-lived signed preview URLs after the admin permission check.
-- Do not add anon/authenticated read or write policies for this bucket.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
