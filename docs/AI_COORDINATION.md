# BTCBOXCDT AI 協作規則（2026-11-23 更新）

> 本文件是目前整合分支的有效協作規則。若舊 issue、舊測試、舊交接文件與本文衝突，以使用者在 2026-11-23 明確確認的產品要求及本文件為準；不得用過期說明阻止已確認功能。

## 1. 當前工作狀態
- Repository: `avali9308-code/btcboxcdt`
- 整合分支：`integration/btcbox-acceptance-20261123`
- 整合 PR：#102（目標 `main`）
- 本階段：處理既有整合缺陷、CI 失敗、說明文件過期及驗收；不是新增產品功能階段。
- PR 未通過必要 CI、review 和驗收前不得合併。
- 不得由本階段觸發正式環境部署、正式資料庫遷移或正式資料修改。生產環境有真實使用者。

## 2. 產品功能邊界（不可用舊文件反向封鎖）
### 認證
以下方式均屬於允許的產品能力，不能以「Google-only」「retired email auth」等舊註記禁用：
1. Google 登入。
2. 電子郵件註冊（須完成 Supabase 郵箱確認及 BTCBOX 帳戶初始化）。
3. 電子郵件 + 密碼登入。
4. 忘記密碼、郵件重設密碼及重新登入。
5. Google 與電子郵件相同時，必須連到同一 Supabase 身份及同一 BTCBOX 帳戶，不得建立重複帳戶或分裂會話。
6. 已有 Google 帳戶可在同一身份上設定郵件密碼；不得建立第二個 auth.users 身份。
7. 錢包登入如現有配置啟用則保留，不得因修復郵件認證而移除。

認證測試必須驗證真實流程及安全邊界；不能只測按鈕存在，也不能把註冊、登入或恢復改成禁止請求以令 CI 通過。郵箱註冊走 Supabase 公開 Auth `signUp` 並使用 `emailRedirectTo` 回到 `/auth/react-callback?intent=register`；確認後由 `/api/supabase-login` 驗證 Supabase identity 並初始化 BTCBOX 帳戶。舊 `/api/register` 直寫路徑保持 fail-closed，不可使用 service-role 繞過郵件確認。

### 訪客與資金安全
- 未登入可瀏覽首頁、公開行情、交易預覽、公開公告及客服說明。
- 個人資產、私人客服對話及真實資金/下單操作必須有服務端身份及權限驗證。
- 未登入不能出現虛構資產或 10,000 USDT 等演示餘額。
- 不得把紙面/演示資料當成真實帳戶資料。
- 不得以修改測試的方式放寬服務端授權或資金保護。

### 產品入口
交易中心保持 Spot / Seconds / Contract / Earn 四個產品入口；不得擅自改成 Futures 或移除入口。顯示文案以當前產品定義及字典為準，測試應驗證正確產品名稱。

## 3. 分工與協作
- 1號 AI：Core/backend 主責。
- 2號 AI：Web App + Admin Panel 主責；本對話助手目前執行 2號工作。
- 3號 AI：架構、API contract、跨模組整合。
- 路由問題目前由其他 AI 處理。2號 AI 不得重複修改路由實作；如發現路由接口問題，記錄並交接。
- 各角色可在授權範圍內實際檢查、修改、測試及提交，但不得直接改動正式環境。
- 跨模組變更先核對接口及負責人，不覆蓋其他角色已完成的有效修復。

## 4. 本階段變更規則
- 優先修復已存在的問題，不藉機擴大範圍。
- 不刪除測試來消除 CI 失敗；只有測試明確過時且已有正確替代覆蓋時，才可修訂測試。
- Playwright 必須在 `npm run build` 後使用 `npm run preview` 驗收 production bundle；不得改回 `vite dev`，因開發模式會啟用 `DEV_OPEN_ACCOUNT_PAGES`，繞過正式環境帳戶頁登入門檻。
- 前端 CI 必須執行 `npm run check:i18n`，驗證 7 份啟用字典及保留的越南語舊字典。
- 每個修復需對應根因、修改檔案、驗證方式及結果。
- 修改測試時須說明它驗證的是產品行為、fixture 還是測試工具；不能弱化核心安全驗收。
- 更新文件時，將舊的相反要求明確標記為已廢止/被取代，避免後續 AI 或自動檢查沿用。
- 不刪除歷史分支，不直接修改 `main`。

## 5. 合併與部署閘門
PR #102 只有在下列項目全部完成後才可提出合併：
- 前端 lint、build、單元測試及 Playwright desktop/mobile 必要測試通過。
- 後端測試、PostgreSQL schema CI、Change Guard 通過。
- Codex review / PR review 中的有效問題已處理。
- 認證、資產、充值/提現、訂單、客服隔離及管理員操作完成交叉核對。
- 遷移順序與執行方式經審查，且不會自動對正式資料庫執行。
- 使用者明確同意合併；正式部署及正式遷移另行確認。

## 6. 交接格式
每次交接必須列出：
1. 已完成檔案及具體改動。
2. 未完成項目與原因。
3. 測試/CI 證據（run、job、commit、結果）。
4. 跨模組接口不一致、衝突、重複代碼及安全風險。
5. 下一責任人及下一步。


## 2026-11-23 authentication and CI acceptance notes
- Email signup must use Supabase Auth confirmation and then `/api/supabase-login`; never bypass confirmation with the legacy `/api/register` route.
- Supabase links identities with the same verified email. For an existing Google account, add an email password to that same Supabase user via `updateUser({ password })`; do not create a second BTCBOX account. The backend must keep the same Supabase UUID mapping.
- Auth rate-limit errors (`over_email_send_rate_limit`) must be translated to a clear wait/check-inbox message. Do not disable email confirmation or raise live rate limits just to make tests pass.
- Read-only Supabase log audit on 2026-11-23 found 7 confirmation-mail send events and 18 email-send rate-limit events (13 confirmation, 5 recovery). No Supabase settings were changed.
- Feature branches run the full frontend/backend checks through their PR; push-triggered CI is restricted to `main` to avoid running the same suite twice for each PR commit.


## 2026-11-24 execution status addendum (supersedes stale branch/PR status above; product rules and ownership remain unchanged)

### Current refs and coordination source
- The requested `chore/shared-ai-coordination` branch does not exist (branch search returned no result; fetching `docs/AI_COORDINATION.md` from that ref returned 404).
- This addendum is based on the current `main` coordination file (blob `0ae2655558aaf361e15ace049645ffddb48d80ac`) and current `main` HEAD `e69cfcd8d6634332d20470d116f716bd23ec4765`.
- Follow-up documentation branch: `integration/btcbox-acceptance-20261124`, created from the exact main SHA above. This run made documentation-only changes; no application, SQL, API, route, trading-layout, or hosted-environment changes.
- The previously named `integration/btcbox-acceptance-20261123` has HEAD `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`, was merged by PR #102 as `f6d62d21e94a234044221320158eeab0d230e1f4`, and is now 99 commits behind main with no unique commits. It is no longer an active integration base.
- `integration/btcbox-mainline-consolidation-20261108` no longer exists. `integration/btcbox-mainline-consolidation-20261118` remains at `9481a3815a7ce9b9601e56474123eee62c2e69b2`, diverged from main (17 commits ahead / 478 behind); do not use it as a current integration base without owner approval.

### PR #67 and PR #102 gate status
- PR #67 is Closed/Merged, not Draft: head `c53fa948a599b560c1319726adfb57be6828b0fa`, merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`, merged 2026-11-08 16:24:57 UTC. Review submissions: 0. Exact-head Backend CI #42498936887 PASS, PostgreSQL schema CI #42498936856 PASS, Frontend CI #42498936859 PASS. Its former branch name is no longer present; it cannot be converted back to Draft.
- PR #102 is also Closed/Merged (2026-11-23 17:49:46 UTC), head `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`, merge commit `f6d62d21e94a234044221320158eeab0d230e1f4`, review submissions: 0.
- Exact PR #102 head CI: Backend #45215510605 PASS (build, backend tests, integration tests, fail-closed config preflight, output checks); PostgreSQL schema #45215510558 PASS (all canonical SQL applied to disposable PostgreSQL); Change Guard #45215510283 PASS; Frontend #45215510322 FAIL. Frontend lint, all locale checks, exact-decimal tests and production build passed, but mobile route/core-flow Playwright failed with 44 failed tests. Examples in the log include missing ETHUSDT/Market overview headings at mobile widths and terminal detail assertions. This is a documented merge-gate deviation: PR #102 was merged while its own body said E2E and review were pending. Do not treat that merge as complete acceptance.
- Current main `e69cfcd8d6634332d20470d116f716bd23ec4765` has only a Vercel success in the combined status response. The available commit-workflow query returned no PR-triggered runs for this merge SHA and is documented to omit push-triggered runs; therefore full current-main GitHub Actions status is NOT VERIFIED, not PASS.

### Current open responsive candidate — PR #113
- PR #113 remains Draft/open, base main `e69cfcd8d6634332d20470d116f716bd23ec4765`, head `d9a4a66505e414640e6fcfe157e061f8bc72183a`, no review submissions. It is a feature branch, not the active integration branch.
- Exact-head Backend CI #45318908851 PASS; Change Guard #45318908877 PASS; Frontend CI #45318908832 FAIL. Frontend lint, locale checks, decimal tests and production build passed; production-bundle critical-route Playwright failed 3 responsive assertions.
- Root mismatch from the exact-head log: `frontend/src/index.css` sets the phone workspace to two equal `1fr 1fr` columns, while `frontend/e2e/responsive-visual-qa.spec.ts` still asserts 55:45 at lines 312 (tablet) and 387 (phone). The project owner's recorded mobile requirement is approximately 50:50 columns. Proposed fix for the owning UI reviewer: align only the stale geometry assertions/tolerance to the approved 50:50 requirement, then rerun production-preview Playwright and inspect screenshots; do not alter the trading layout to satisfy a stale 55:45 assertion. This run did not modify PR #113 or the locked trading page.
- PR #113's screenshots were uploaded, but owner visual acceptance and real-device acceptance remain NOT VERIFIED.

### Verified current-main application status within 2-AI scope
- `frontend/src/features/assets/AssetsPage.tsx` blob `1f127395881ad29488808864f0f9d285468d3182` reads the authenticated account snapshot and no longer imports/uses `useTrading`, `paperBalances`, or demo initial balances.
- `backend/tests/manual-credit-assets.test.js` blob `4d67c8a478b711b77d5007de6a8bb9e90fb23bd3` includes a regression assertion that real assets do not include paper-trading demo funds. This is source-level coverage, not a live account verification.
- `frontend/e2e/auth-routes.spec.ts` blob `11009de3099d4ec48babe22b14bba37fddc6784a` includes email/password login, Supabase email-confirmation registration/callback, password recovery, rate-limit messaging, and protected-route gates. These E2E cases use mocked Auth/API responses; hosted Email/Google provider configuration and a real staging login remain NOT VERIFIED.

### Cross-team SQL/API and worker risks found on current main (record only; ownership is not 2-AI)
- `backend/api-core.js` blob `beb7e207c12d743df3836669d67514af9535ac68`, close-position route lines 3118-3129: reads the current position and returns `NO_POSITION` before any idempotent replay lookup; it passes the newly-read position quantity into `perp_submit_order`. A fully filled retry can therefore return NO_POSITION, and a partial-fill retry can submit a changed quantity against the original client order ID. The route also has no explicit `rateCheckShared` call in this block. API owner should replay by authenticated UID + stable client_order_id before reading mutable position state, preserve the original intent, and add shared rate limiting/fail-closed tests.
- `backend/supabase/sql/0041_perpetual_contract_v1.sql` blob `824514a8c076452de0ec882634789df197d22dc9`, lines 392-401: order replay compares symbol/type/side/leverage/quantity/price but not `reduce_only` or `close_position`. The previously reviewed 0042-0044 migration files from the stale 2026-11-18 integration branch are not present at those paths on current main (404). Database owner should re-derive and port the financial-operation allowlist, funding-settlement idempotency and order-intent flag checks onto the current migration chain, with fresh disposable-PostgreSQL tests; do not cherry-pick blindly from the 478-commit-behind branch.
- `backend/scripts/perp-funding-worker.js` blob `48da054ba1ad486d344869b6e8d58f7fe57ca814`, lines 40-59: ignores non-2xx responses for funding-rate insert/PATCH, catches per-position settlement errors and still marks the rate settled/advances the next funding time. Backend owner should stop cycle advancement after any failed user settlement and make retries observable/idempotent.
- `backend/scripts/perp-liquidation-worker.js` blob `87c509bf4a225684aca71076205acb7b10c767a3`, lines 19-26: a failed REST read is converted to an empty position list; startup checks only URL/service key and has no explicit perpetual-engine safety gate. Backend/owner must define the independent protective-liquidation policy, fail closed on read errors, and test it without disabling necessary protection for existing positions.
- Existing source tests are insufficient for these cases: `backend/tests/perpetual-api-contract.test.js` blob `d34e21290a209c2bb4721da67988f8b7de0b8787` lines 69-76 does not cover close replay/rate limits; `backend/tests/perpetual-sql-contract.test.js` blob `49ccf6caf95cdda4925e11bcb7fe54754c2715d0` lines 53-60 does not compare the two close-intent flags.

### Release readiness and next actions
- Overall status: NOT READY. PR #102 merged despite failed frontend E2E and no review; PR #113 remains Draft with 3 responsive assertions failing; current-main full push-triggered Actions are not exposed by the available query; hosted Supabase schema parity, hosted Auth, live financial execution, production flags, real-device visual acceptance and production readiness are NOT VERIFIED.
- Next actions by owner: (1) re-establish/approve the active integration branch and review gate after PR #102's premature merge; (2) API/DB owners address the close-position idempotency, missing order-intent flag comparison and funding/liquidation worker fail-closed gaps on a current-main-derived branch; (3) PR #113 owner aligns responsive tests to the approved 50:50 layout and reruns desktop/mobile production-preview tests; (4) owner completes visual and staging Auth acceptance. No production deployment or hosted database changes are authorized by this addendum.
