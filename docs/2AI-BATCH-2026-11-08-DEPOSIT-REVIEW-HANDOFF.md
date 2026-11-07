# 2号 AI — Admin deposit-review boundary handoff — 2026-11-08

## Verified current behavior (unified branch `work/btcbox-unified-20261104`)

- The Admin tab named `deposits` is a **deposit-address / finance-configuration** screen. It edits customer receiving addresses and withdrawal fee configuration; it is not a pending-deposit review queue.
- Staff manual credit is available from **Users & manual credit** after selecting a user. The request sends `uid`, `coin`, `amount`, required `reference`, optional note and an idempotency key to `POST /api/admin/deposit/confirm`.
- The UI explicitly states that manual credit does not create a pending deposit order. It displays only the selected user's recent deposit history (latest 20) and labels the history source.
- The React API client exposes `adminManualCredit` for the manual-credit endpoint and account snapshot deposit history. The inspected Admin API surface does not expose a pending-deposit list, deposit-detail/evidence read, or approve/reject/mark-credited transition.
- Admin stats expose pending withdrawal and KYC counts, but no pending-deposit count.
- Backend route inspection confirms the existing `admin/deposit/confirm` permission and manual-credit handler. No separate pending-deposit review route was found in the inspected route/API surface.

## Ownership / required next handoff

- **1号 Core:** confirm whether a pending deposit intake/record lifecycle already exists in the canonical backend/database but is not exposed to the Admin client. If it exists, publish the exact list/detail/evidence/review API contract and permissions. If it does not exist, define the lifecycle and persistence/audit/idempotency rules before implementing it.
- **3号 architecture/API:** own the cross-module contract decision, including statuses, evidence/transaction-reference fields, duplicate-chain/transaction handling, reviewer permissions, audit event names, and idempotent approve/reject semantics.
- **2号 Web/Admin:** once the contract is confirmed, implement the real pending-deposit queue, detail/evidence view, review actions, refresh/error states and browser regression tests. Do not display synthetic queue rows or map manual credits into a fake pending-review workflow.

## Scope decision

This is a verified cross-role integration gap, not a request to change financial behavior unilaterally. The existing manual-credit flow remains intact. No Core financial API, database schema, ledger, permission, production record, real deposit, merge or deployment was changed by this handoff.

## Evidence classification

- **SOURCE OBSERVED:** Admin tab labels and contents; manual-credit request payload and route; Admin stats fields; selected-user deposit-history projection.
- **NOT VERIFIED:** whether a separate pending-deposit lifecycle exists in another Core module, SQL migration, provider webhook, or external service outside the inspected React/Admin route surface. Core/architecture owners must confirm before a UI is built.
