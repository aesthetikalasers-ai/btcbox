# BTCBOX KYC document evidence storage

## Runtime contract

- Customer KYC submission requires one clear identity-document image in addition to name, document type and document number.
- The browser accepts JPEG, PNG and WebP, downsizes/compresses the image to JPEG, and caps the encoded image at 512 KiB. The original selected file must be no larger than 8 MiB.
- The backend independently validates base64, byte size and file signature. It does not trust the browser MIME declaration.
- The backend uploads the image to the private Supabase Storage bucket `kyc-documents` using the server-only Supabase service credential. Object keys are scoped under the authenticated BTCBOX user ID.
- Customer-facing account responses never return the object path or a storage URL.
- The admin KYC list returns a five-minute signed preview URL only after the caller passes the existing `kyc.read` permission check. The image is not public.
- Standard KYC approval requires a stored document image. The existing explicit admin-exception path remains available only with a recorded reason.

## One-time Supabase Storage setup

Before enabling KYC image submissions in a hosted Supabase project:

1. Open Supabase Dashboard → Storage → New bucket.
2. Set the bucket ID to `kyc-documents`.
3. Keep **Public bucket** disabled.
4. Set the maximum file size to **512 KiB**.
5. Allow only `image/jpeg`, `image/png`, and `image/webp`.
6. Do not add anonymous or customer-facing read/write policies. The BTCBOX API uses the server-side service credential for upload and short-lived signed previews.

The API fails closed when the bucket is unavailable. No bucket was created and no hosted Supabase setting was changed by this code batch.

## Verification boundary

Source regression tests cover validation, private storage calls, signed URL expiry, admin permission boundaries and the customer/admin UI contract. Hosted bucket configuration, real upload/download, browser E2E, retention/deletion policy and production operation remain **NOT VERIFIED**. Do not upload real identity documents to a non-production test environment.

## Privacy and object lifecycle hardening

- The general administrator `users.read` user-detail endpoint exposes only the KYC status. Full identity numbers and Storage object paths are not included; KYC evidence remains behind the separate `kyc.read` route.
- Every signed preview and deletion operation verifies that the object key belongs to the target user's exact UID and matches the generated UUID filename format. This prevents a corrupted KYC record from being used to sign or delete another user's object.
- When a rejected applicant resubmits, the new image is saved first; only after the new KYC record is persisted does the API attempt to delete the previous user-owned image. If persistence fails, it attempts to remove the new unreferenced upload and leaves the previous evidence intact.
- No automatic deletion is performed after approval or rejection. Retention duration and legal deletion requirements remain a release-policy decision and must be explicitly set before production KYC use.
