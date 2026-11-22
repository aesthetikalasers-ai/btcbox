# BTCBOX — 项目交接状态

**更新日期：** 2026-11-16  
**仓库：** `avali9308-code/btcboxcdt`  
**状态：** 协作规则、执行规划及规划纪律已更新；功能开发尚未据此宣告完成。

## 当前分支策略
- `main`：唯一正式基准。
- `working`：唯一共同开发分支。
- `backup/main-before-unified-replacement-20261107`：历史备份，不用于日常开发。
- 未经所有者明确授权，不创建其他长期分支、不合并、不部署。

## 本次文档更新
- 在 `docs/AI_COORDINATION.md` 增加第 8 节“规划纪律与防止项目漂移”，明确所有 AI（包括本助手）必须遵守。
- 在 `docs/AI_EXECUTION_PLAN_2026-11-16.md` 增加持续执行纪律，要求每次会话定位当前阶段、按退出条件推进、控制新需求插队并更新状态。
- 本次仅修改项目文档；未修改应用代码、数据库或 Supabase 配置；未部署。

## 当前开发状态与阶段位置
- 当前执行阶段：**阶段 0 — 基线确认**（需要在实际开发启动时核实最新 main/working SHA、代码入口、接口边界和基线测试）。
- 阶段 1 认证弹窗：待实施/验证。
- 阶段 2 Earn 合同与数据库基础：待实施/验证。
- 阶段 3 Admin Earn：待实施/验证。
- 阶段 4 客户 Earn：待实施/验证。
- 阶段 5 端到端账本验证：待实施/验证。
- 阶段 6 回归与视觉验收：待实施/验证。

以上均不得因规划文件存在而视为已完成。阶段 0 也不得仅凭此前对话中的旧 SHA 视为当前已核实；开始下一轮开发时必须重新读取远程 refs。

## 每次启动提醒（所有 AI，包括本助手）
**先读规则、再看状态、定位阶段、完成当前项、验证退出条件、更新交接；不另起规划、不擅自插队。**

## 每次交接必须更新
记录当前 main/working 完整 SHA、当前阶段、已完成事项及证据、进行中事项、变更文件、测试命令和结果、阻塞项、未验证事项及下一步唯一优先任务。没有证据的事项标记为 NOT VERIFIED。


## 统一进度汇报格式

- 已新增 `docs/AI_STATUS_REPORT_TEMPLATE.md`，作为所有 AI、开发人员和项目协调负责人的强制进度汇报模板。
- 适用时机：开始任务、完成任务、阻塞、阶段验收及跨成员/跨会话交接。
- 必须记录阶段与退出条件、完成事项、修改文件、分支和完整 SHA、测试命令/结果/证据、未完成事项、阻塞、下一项唯一优先任务及规划一致性。
- 未验证事项标记 NOT VERIFIED；没有提交不得编造 SHA；阶段退出条件未满足不得报告通过。
- 该模板对所有参与者一视同仁，并要求重要进度后同步更新本状态文件。


## 2026-11-22 — Admin portal and KYC mobile image repair

- Owner explicitly instructed this repair to be committed directly to `main`; this task-specific instruction superseded the normal working-branch rule for these changes only. No merge or manual Vercel deployment was run.
- Main commits (latest first): `b0f74488bcd8c7cab2ab9600283a3a02208519f8` (admin entry tests), `f31597c1d75f1f8aea8e4e942b3539f4c1ded8b8` (admin route), `1f1623edbbbad7c6d37239ed5c462f1589d747d1` (dedicated admin sign-in surface), `8c43ef2b228631debe12c754440266c9e85c9a62` (KYC mobile decoder test), `77e2bc507d01a9986ece3d08e97b77c2b4b33ef0` (KYC mobile image preparation).
- Files changed: `frontend/src/features/pages/Pages.tsx`, `backend/tests/kyc-document-storage.test.js`, `frontend/src/features/admin/AdminPage.tsx`, `frontend/src/App.tsx`, `backend/tests/admin-entry.test.js`.
- KYC frontend now falls back from `createImageBitmap` to native `Image` decoding, accepts image file selection broadly (including HEIC/HEIF where the browser can decode it), and still converts to JPEG <=512 KB before upload. Private bucket and server-side validation remain unchanged.
- Admin portal now has an unmistakable standalone sign-in header and explicit `/admin/*` route coverage; authentication still uses the existing Supabase Auth + database RBAC flow. No bypass or static credentials were added.
- Verification: **NOT VERIFIED** — source updates committed successfully, but no local build/test runner was available in this session and no CI result has been observed yet. Production deployment status and real mobile upload/admin login flows remain **NOT VERIFIED**.
- Previous KYC decoder commits on `working` were left intact; this task did not merge or rewrite that branch.

## 2026-11-22 — Admin OAuth return and KYC Storage repair (2号 AI)

### Scope and branch baseline
- Current planned stage remains **Stage 1 — authentication dialog, in progress**. This owner-requested repair addresses the standalone Admin Google OAuth return path and the blocking hosted KYC Storage configuration; no Earn or financial business rules were changed.
- Main baseline before this repair: `c8af32fe78b3030c31399053fd0c8ce24547249e`.
- Shared development branch observed during this repair: `working` HEAD `50d13511e0309d963df7c4afeff1124275c97f12`; it was not modified or rewritten.
- Code commit: `fb3afe1888947faf21b62acfba20bb9b317c9c17`. This state report is included in the final commit of the same main-branch update.
- Production deployment before this code update: main commit `c8af32fe78b3030c31399053fd0c8ce24547249e`, Vercel state **READY**. A live Playwright probe of `/admin` returned HTTP 200, rendered the distinct “Administrator sign in” surface, and reported no browser page errors.

### Root causes and fixes
- **Admin login returning to the customer front end — NEEDS FIX resolved in source:** `AdminPage` passed `redirectTo="/admin"`, but the standalone Google sign-in handler removed `btcbox:oauth:return-to` whenever `embedded=false`. The OAuth callback already consumed a saved same-origin return path; the sign-in handler now persists the validated `redirectTo` for standalone Admin login and rejects protocol-relative/external paths and callback loops.
- **KYC photo upload unavailable — hosted Storage configuration resolved:** the production Supabase project had no `kyc-documents` bucket, while the backend correctly failed closed with `KYC_STORAGE_UNAVAILABLE`. Created the bucket as private, with a 524,288-byte limit and only `image/jpeg`, `image/png`, and `image/webp`. A read-only check confirmed no `storage.objects` policy references that grant customer access to this bucket. The frontend already supports native image-decoder fallback and normalizes supported mobile image formats to JPEG before upload.
- Added the idempotent bucket setup source at `backend/supabase/operations/kyc-document-storage-bucket.sql` and updated `docs/KYC_DOCUMENT_STORAGE.md`.

### Files changed
- `frontend/src/features/auth/AuthPages.tsx`
- `frontend/e2e/admin-oauth-return.spec.ts`
- `backend/tests/admin-entry.test.js`
- `backend/tests/kyc-document-storage.test.js`
- `backend/supabase/operations/kyc-document-storage-bucket.sql`
- `docs/KYC_DOCUMENT_STORAGE.md`
- `docs/AI_PROJECT_STATE.md` (this handoff record)

### Verification evidence
- `npx tsc --noEmit` — **PASS**.
- `npm run build` in `frontend/` — **PASS**.
- `npm run build` in `backend/` — **PASS**.
- `node --test tests/admin-entry.test.js tests/kyc-document-storage.test.js` in `backend/` — **PASS**.
- `npx playwright test e2e/admin-oauth-return.spec.ts --project=desktop-chromium --reporter=line` — **PASS**, 2/2 tests: standalone Admin sign-in saves `/admin`; OAuth callback consumes it after synthetic Supabase session restoration.
- Hosted Storage read-only verification — **PASS**: `kyc-documents`, private, 524,288 bytes, JPEG/PNG/WebP; no matching customer-facing `storage.objects` policy.
- Live pre-fix production route probe — **PASS**: `/admin` returned HTTP 200 and the dedicated Admin sign-in heading; no page errors.
- Full backend suite — **NEEDS FIX**: 558 passed, 2 failed in `google-only-auth.test.js` due existing auth assertions; one explicitly expects `requestPasswordReset` to be absent while the current auth page includes it. These unrelated assertions were not changed in this targeted repair.
- `npm run check:i18n` — **NEEDS FIX**: 11 existing unregistered static `t()` keys and one missing legacy Vietnamese key. No locale files were changed in this repair.

### Not yet verified / release boundary
- A real KYC upload, signed admin preview, and download have **NOT VERIFIED**; no real identity document was uploaded.
- Physical iOS Safari HEIC/HEIF selection/decoding has **NOT VERIFIED**; the source fallback is covered by existing regression assertions, not a physical-device run.
- The new main commit has not yet completed its automatic Vercel production build at the time of this record. No manual deployment was run.
- No user Auth membership, financial data, trading state, or environment variables were changed by this repair; the only hosted write was creation of the private KYC Storage bucket.

### Next single priority
- After the automatic Vercel deployment for the final main commit reaches **READY**, have the owner test Google sign-in from `/admin` with the authorized Super Admin account and confirm it remains at `/admin`; then verify KYC with a synthetic, non-sensitive test image. Do not use a real identity document for testing.


## 2026-11-23 — KYC upload size and memory safeguards (2号 AI)

- Work branch: `fix/kyc-upload-2mb-memory-20261123`, created from `main` baseline `8eef5f34ed7bf8e7790ae57516ce5f1810b7b24b`.
- Agreed target: original selected image <= 5 MiB; compressed JPEG <= 2 MiB; private Supabase `kyc-documents` bucket <= 2,097,152 bytes; KYC POST body <= 3 MiB; all other API request bodies remain <= 1 MiB.
- Frontend: pre-resize with `createImageBitmap` when supported, 2 MiB compression cap, reuse and clear canvas, close ImageBitmap, revoke object URL, and encode the Blob from an ArrayBuffer in chunks rather than creating a second data URL copy.
- Backend: KYC-only request body allowance, reject oversized gateway-encoded requests before decoding, validate decoded base64 length before allocating the image Buffer, and avoid re-encoding the full image for canonical comparison.
- Supabase: updated only the repeatable bucket SQL in this branch to 2 MiB. **No hosted Supabase setting, production database, Auth setting, environment variable, or Storage bucket was changed.**
- Localization: updated the KYC upload guidance in all eight locale dictionaries.
- Files changed: `frontend/src/features/pages/Pages.tsx`, `frontend/src/lib/locales/{en,zh-CN,ja,de,it,pt,es,vi}.json`, `backend/api-core.js`, `backend/tests/kyc-document-storage.test.js`, `backend/supabase/operations/kyc-document-storage-bucket.sql`, `docs/KYC_DOCUMENT_STORAGE.md`.
- Static source checks: **PASS** for configured limits, request-body isolation, private bucket setting, memory cleanup hooks, canonical locale keys and JSON parsing.
- Automated backend/frontend builds and full test suites: **NOT VERIFIED**. The local container cannot resolve GitHub to clone the repository, and the normal frontend/backend CI workflows are not configured to run on push to this task branch. No PR was opened solely to trigger CI.
- Real image upload, mobile device memory behavior, HEIC/HEIF device decoding, and hosted bucket configuration after the proposed change: **NOT VERIFIED**.
- Release boundary: do not merge or deploy this branch; do not apply the bucket SQL to production until the full project repair batch is reviewed and the owner authorizes the single coordinated release.


## 2026-11-23 — Real wallet balance isolation (2号 AI)

- Work branch: `fix/kyc-upload-2mb-memory-20261123`; based on the same isolated repair branch. `main` and production were not changed.
- Found and removed a customer asset-page merge that overwrote authenticated account balances with local paper-trading balances.
- The real Assets page now renders only `account.balances` returned by `GET /api/account`. Paper-trading state remains separate and is not presented as customer funds.
- Added `backend/tests/assets-real-balance-source.test.js` to prevent reintroducing the local paper-ledger merge.
- Source-level regression assertions: **PASS** (account API source retained; paper-ledger import/state merge absent).
- Automated Node test execution, TypeScript check, frontend build, and live account verification: **NOT VERIFIED** in this session.
- Release boundary unchanged: no PR, merge, deployment, production database write, or Supabase setting change.


## 2026-11-23 — Admin support conversation visibility (2号 AI)

- Work branch: `fix/kyc-upload-2mb-memory-20261123`; no changes to `main` or production.
- The Admin support inbox previously returned only customer-authored messages, hiding administrator replies. The UI also rendered one card per incoming message, which made one customer's history appear as separate queue items.
- The admin messages endpoint now returns both customer and administrator messages with their owning UID and email; the frontend groups them into one UID-scoped thread and displays sender, timestamp, full message history, and a derived unanswered-message count/status.
- Added `backend/tests/admin-support-thread-view.test.js` to guard the response contract and UID grouping.
- This is a conversation-history and unanswered-reply visibility improvement. **Persistent administrator unread/read receipts are still NOT VERIFIED / NOT IMPLEMENTED by this change**; the derived unanswered count is not represented as an unread count.
- Automated test execution, TypeScript check, frontend build, A/B customer isolation end-to-end test, and audit-outbox consistency verification: **NOT VERIFIED**.
- Release boundary unchanged: no PR, merge, deployment, or production Supabase/database changes.


## 2026-11-23 — International bank payout details and Admin management (2号 AI)

- Work branch: `fix/kyc-upload-2mb-memory-20261123`; no changes to `main` or production.
- Customer bank payout forms now accept either a local account number or an IBAN. US routing number, SWIFT/BIC, country code, and bank address are optional rather than universally required.
- Backend validation accepts alphanumeric local account identifiers, checks the general IBAN structure, and validates US routing/SWIFT only when supplied. It does not claim to verify bank ownership or execute payments.
- Customer account number, IBAN, and routing values are masked in customer-facing account/address responses. The customer-facing UI remains create/view only; customer PATCH/DELETE routes remain forbidden.
- Added a dedicated Admin tab protected by `payout_addresses.read_sensitive`; edit/delete actions additionally require `payout_addresses.manage`. Admin changes require a reason, create address audit entries, and are sent to the admin audit outbox.
- Added client API methods for listing and managing payout records, plus regression tests covering international fields, masking, immutable customer records, and Admin permissions/actions.
- Automated execution, TypeScript build, and live browser tests: **NOT VERIFIED** in this session. IBAN format validation is structural and does not perform bank-side account verification.
- Release boundary unchanged: no PR, merge, deployment, or production database/Supabase changes.


## 2026-11-23 — Admin support read receipts (2号 AI)

- Added a per-administrator, per-customer read receipt keyed by the authenticated administrator ID and customer UID. One staff member marking a thread read does not clear another staff member's unread count.
- Admin inbox unread counts now include only customer-authored messages newer than that administrator's saved read timestamp.
- Added an authorized `POST /api/admin/support/read` action, with an audit-outbox event. Repeated marks of an already-read thread are idempotent.
- Admin UI now displays the persistent unread count and provides an explicit Mark read action. A successful reply also attempts to persist the thread's read receipt; a read-receipt failure is reported separately and does not falsely report that the reply failed.
- Customer unread count remains separately calculated from admin-authored messages after the customer's `last_read_chat_at`; opening the customer's support conversation marks those messages read.
- Added `backend/tests/admin-support-read-receipts.test.js`.
- Automated execution, multi-admin concurrency, and A/B user end-to-end verification: **NOT VERIFIED**.
- No PR, merge, deployment, or production database changes.
