# Initial BTCBOX Super Admin bootstrap

This is a one-time, owner-controlled database operation. It is **not** an HTTP endpoint and must never be run from the browser or with a service-role API token.

## Before running

1. Create or verify the owner account using the configured Supabase Auth Email or Google sign-in.
2. In Supabase Dashboard → Authentication → Users, copy the exact UUID of that account. Do not use email as the identity key.
3. Confirm the target is the intended BTCBOX project and its BTCBOX schema is the new empty schema.
4. Confirm the fresh-schema bootstrap has completed in an isolated PostgreSQL environment and the owner has explicitly approved this one-time action.

## Run once in Supabase SQL Editor

Run as the project database owner (\`session_user = postgres\`). Replace all three placeholders with the exact values approved by the owner.

\`\`\`sql
select private.bootstrap_super_admin_v1(
  'YOUR_EXISTING_AUTH_USER_UUID'::uuid,
  'Owner-approved initial BTCBOX Super Admin bootstrap',
  'YOUR_CHANGE_REFERENCE'
);
\`\`\`

The database function verifies that the Auth UUID exists, rejects a second bootstrap if a Super Admin already exists, creates the active Super Admin membership, and appends an owner-bootstrap audit event. It is granted only to \`postgres\`, not \`service_role\`, \`anon\`, or \`authenticated\`.

After a successful result, sign in through the React app and open \`/admin\`. The Super Admin receives the full permission catalogue through the server-side membership lookup and can create/manage delegated administrators and Seconds policy versions.

Do not execute this operation from this chat. No hosted database has been changed. If the UUID, project, or owner approval is uncertain, stop rather than guessing.
