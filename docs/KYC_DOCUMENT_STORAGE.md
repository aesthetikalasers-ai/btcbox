# BTCBOX KYC document evidence storage

## Runtime contract

- Customer KYC submission requires one clear identity-document image in addition to name, document type and document number.
- The browser accepts image files supported by its decoder (including JPEG, PNG, WebP and HEIC/HEIF where available), downsizes/compresses them to JPEG, and caps the encoded image at 2 MiB. The original selected file must be no larger than 5 MiB. If a mobile browser cannot decode a HEIC/HEIF image, it shows a clear format error instead of silently failing.
- The backend independently validates base64 length, decoded byte size and file signature. KYC POST requests have a dedicated 3 MiB JSON body limit to accommodate a 2 MiB image encoded as base64; all other API requests remain limited to 1 MiB. It does not trust the browser MIME declaration.
- The backend uploads the image to the private Supabase Storage bucket `kyc-documents` using the server-only Supabase service credential. Object keys are scoped under the authenticated BTCBOX user ID.
- Customer-facing account responses never return the object path or a storage URL.
- The admin KYC list returns a five-minute signed preview URL only after the caller passes the existing `kyc.read` permission check. The image is not public.
- Standard KYC approval requires a stored document image. The existing explicit admin-exception path remains available only with a recorded reason.

## One-time Supabase Storage setup

The production Supabase project previously had this private bucket configured and verified at 512 KiB. This task branch proposes a 2 MiB limit; no hosted Supabase setting has been changed. After review and approval, apply backend/supabase/operations/kyc-document-storage-bucket.sql to the intended environment:

1. Open Supabase Dashboard → Storage → New bucket.
2. Set the bucket ID to `kyc-documents`.
3. Keep **Public bucket** disabled.
4. Set the maximum file size to **2 MiB (2,097,152 bytes)**.
5. Allow only `image/jpeg`, `image/png`, and `image/webp`.
6. Do not add anonymous or customer-facing read/write policies. The BTCBOX API uses the server-side service credential for upload and short-lived signed previews.

Previously verified hosted configuration on 2026-11-22: kyc-documents was private, had a 524,288-byte limit, and allowed only JPEG, PNG and WebP. This task branch proposes raising the bucket limit to 2,097,152 bytes; no hosted Supabase setting has been changed. The API continues to fail closed if storage is unavailable.

## Verification boundary

Source regression tests cover validation, private storage calls, signed URL expiry, admin permission boundaries and the customer/admin UI contract. The 2 MiB bucket SQL change is staged on this task branch only; hosted configuration after the proposed change is **NOT VERIFIED**. Real upload/download with a test image, physical iOS HEIC decoding, retention/deletion policy and production operation remain **NOT VERIFIED**. Do not upload real identity documents to a non-production test environment.

## Memory and request-size controls

- Original selected image: maximum 5 MiB.
- The browser asks `createImageBitmap` to pre-resize to a 1,600-pixel width when supported, then downsizes to a maximum 2,048-pixel longest edge. It reuses a single canvas across compression attempts, clears canvas dimensions in `finally`, closes `ImageBitmap`, and releases the object URL. Older decoders use the native image fallback.
- The compressed Blob is converted to base64 from an `ArrayBuffer` in bounded chunks rather than creating a second full-size data URL string.
- The backend checks the encoded gateway-body size before decoding, applies a 3 MiB body limit only to KYC POST, and retains the 1 MiB limit for every other endpoint. Base64 validation checks decoded length before allocating the image Buffer and avoids a full re-encode copy.

## Privacy and object lifecycle hardening

- The general administrator `users.read` user-detail endpoint exposes only the KYC status. Full identity numbers and Storage object paths are not included; KYC evidence remains behind the separate `kyc.read` route.
- Every signed preview and deletion operation verifies that the object key belongs to the target user's exact UID and matches the generated UUID filename format. This prevents a corrupted KYC record from being used to sign or delete another user's object.
- When a rejected applicant resubmits, the new image is saved first; only after the new KYC record is persisted does the API attempt to delete the previous user-owned image. If persistence fails, it attempts to remove the new unreferenced upload and leaves the previous evidence intact.
- No automatic deletion is performed after approval or rejection. Retention duration and legal deletion requirements remain a release-policy decision and must be explicitly set before production KYC use.
