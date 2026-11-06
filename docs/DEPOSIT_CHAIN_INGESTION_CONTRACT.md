# BTCBOX Deposit Chain-Ingestion Contract

Status: design contract only; no ingestion worker or verifier integration is implemented in this repository.

## Current verified boundary

- The user-facing `POST /api/deposit` route accepts an empty/zero amount only to return a configured deposit address.
- A positive amount supplied by the user is rejected with HTTP 403. A client-submitted amount, txid, screenshot, or claimed confirmation count must never be treated as proof of payment.
- Migration `0016_financial_deposit_chain_verification_v3.sql` provides the service-role-only `verify_and_credit_deposit_atomic(...)` RPC. It requires an existing pending `deposit_records` row, locks it, checks asset/network and exact amount, checks a request hash and confirmation threshold, then calls the canonical financial operation and records the confirmed state plus audit event.
- That migration does not create pending deposit intents. No in-repository chain indexer, webhook receiver, polling worker, pending-intent ingestion path, or scheduler has been identified.
- Do not enable user deposit crediting until a trusted ingestion path exists and is independently tested.

## Required system boundary

The implementation must keep three separate responsibilities:

1. **Deposit intent creation** — a server-authenticated operation creates a pending record tied to an authenticated user, a server-selected supported asset/network, a server-controlled destination address, and an immutable expected amount or payment policy. The exact product flow and whether amount is fixed or open must be explicitly approved before implementation.
2. **Chain observation** — a trusted chain adapter independently reads a canonical chain source and proves transaction inclusion, destination ownership, asset contract/mint where applicable, network identity, observed amount, block/slot identity, and confirmation/finality state. Browser data and user-submitted evidence are not trusted observations.
3. **Atomic credit** — only the trusted server-side verifier may call `verify_and_credit_deposit_atomic` using a server-held service credential. The RPC remains the sole credit authority; never credit from a browser, admin page, webhook payload alone, or legacy state document.

## Required controls before implementation

### Identity and destination binding
- Maintain an explicit allowlist mapping product asset/network identifiers to chain IDs, native assets or token contract/mint identifiers, decimals, and confirmation/finality policy.
- Resolve deposit destination from server-owned account/address records. Do not accept an arbitrary destination from the browser.
- Bind every pending intent to one user, one asset/network pair, one expected amount policy, and one unique server-generated deposit ID.
- Do not infer network equivalence from ticker symbols (for example, USDT on different networks is not interchangeable).

### Chain observation
- Normalize transaction identifiers according to the specific chain adapter; do not lowercase or otherwise normalize opaque identifiers generically.
- Verify successful execution, canonical inclusion, exact destination, token/native asset identity, amount in integer base units, and the correct network.
- Define finality/confirmation thresholds per chain and document the source of truth for those thresholds.
- Handle replaced, dropped, failed, reverted, and reorganized transactions. A pre-credit reorg must prevent credit; a post-credit reorg must enter an explicit incident/compensating-ledger workflow and must never silently edit balances.
- Reject unsupported tokens, wrong networks, partial payments, overpayments, and ambiguous transfers unless a separately approved policy defines their handling.

### Idempotency and concurrency
- Derive a stable observation/request ID from trusted chain identity and the pending intent; bind it to a canonical request hash.
- Enforce uniqueness for the chain/network/transaction/output-or-log identity at the ingestion layer, and preserve the database RPC's idempotent replay behavior.
- Retries must reuse the same request ID and exact payload. A mismatched replay must alert and fail closed.
- Concurrent observations for the same pending intent must serialize through the database row lock and financial operation idempotency key.

### Operational security
- Authenticate webhook delivery with provider signature verification, timestamp/replay protection, and an allowlisted endpoint/provider configuration; still independently verify chain data before credit.
- For polling workers, use server-side credentials, bounded batches, lease/claim semantics, retry backoff, and a dead-letter/manual-investigation path.
- Never expose the Supabase service-role credential to a browser, mobile client, public route, or log.
- Emit structured, redacted operational events for observation received, validation rejected, pending retry, confirmed credit, duplicate replay, reorg, and dead-letter outcomes.
- Alert on stale pending intents, repeated provider failures, duplicate/mismatched transaction claims, reorgs, and credit RPC failures.
- Preserve an immutable audit trail that links the pending intent, trusted verifier identity, chain observation, and financial operation ID.

## Acceptance gates

Before enabling deposit crediting, all of the following must be evidenced:

1. Approved asset/network/address mapping and confirmation policy.
2. A trusted pending-intent creation contract and ownership checks.
3. An independently authenticated chain observation adapter.
4. Reorg, duplicate, retry, partial/overpayment, and concurrency tests using isolated fixtures.
5. A successful isolated end-to-end test proving one observation produces exactly one ledger credit and one linked audit event.
6. Read-only production schema/privilege checks confirming the required RPC and constraints exist.
7. Explicit user approval for any production migration, scheduler/secret configuration, feature-flag enablement, or deployment.

Until those gates are met, keep the positive-amount user deposit route fail-closed and do not create financial rows or balances from client input.

## Explicitly unresolved decisions

- Which chain data providers or self-hosted nodes will be trusted.
- Supported asset/network allowlist and per-network finality thresholds.
- Whether deposit intents use fixed amounts, open amounts, or unique per-user addresses.
- Who owns address derivation and custody/key management.
- Worker hosting/scheduling, secret ownership, monitoring, and incident response.
- The approved policy for partial payments, overpayments, and post-credit reorg recovery.
