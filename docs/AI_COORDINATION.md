# BTCBOXCDT AI 協作規則（2026-11-28 更新）

> 本文件是目前整合分支的有效協作規則。若舊 issue、舊測試、舊交接文件與本文衝突，以使用者在 2026-11-23 明確確認的產品要求及本文件為準；不得用過期說明阻止已確認功能。

## 1. 當前工作狀態
- Repository: `avali9308-code/btcboxcdt`
- 整合分支：`integration/btcbox-acceptance-20261128`
- 整合 PR：本輪 Draft PR（目標 `main`；建立後以 GitHub 實際狀態為準）
- PR #102 已於 2026-11-23 合併；其歷史驗收紀錄不得代替本輪最新 HEAD 驗證。
- 本階段：處理既有整合缺陷、CI 失敗、說明文件過期及驗收；不是新增產品功能階段。
- 新 Draft PR 未通過必要 CI、review 和驗收前不得合併。
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
PR #102 已合併。任何後續整合 PR 只有在下列項目全部完成後才可提出合併：
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


## 2026-11-28 latest-main integration run

### Coordination and branch facts
- The requested ref `chore/shared-ai-coordination` does not exist: GitHub returned 404 (no commit for that ref). The current coordination source was therefore read from `main`, file `docs/AI_COORDINATION.md`, blob `0ae2655558aaf361e15ace049645ffddb48d80ac`.
- Exact main base for this run: `d4a4b63e63fa9fe2be08bf4d6f34f219832ff7df`.
- PR #67 is CLOSED / MERGED, head `c53fa948a599b560c1319726adfb57be6828b0fa`, merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`. It cannot be kept Draft after merge. Its old head branch `integration/btcbox-mainline-consolidation-20261108` is no longer listed among repository branches.
- PR #102 is CLOSED / MERGED, head `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`, merge commit `f6d62d21e94a234044221320158eeab0d230e1f4`.
- Previous branch `integration/btcbox-mainline-consolidation-20261127` is at `6f047b74acf98bc3c26787e51d1750528f95f365`, 2 commits ahead and 38 behind current main; do not use it as the current integration base.
- This run's branch is `integration/btcbox-acceptance-20261128`, created directly from the exact main SHA above.

### Exact-main CI evidence
For `d4a4b63e63fa9fe2be08bf4d6f34f219832ff7df`:
- Backend CI run `46099148255`: success.
- Change Guard run `46099148174`: success.
- Frontend CI run `46099148319`: failure, job `140837380602`; lint, locale, visual-standard, decimal, and production build steps passed, but production-bundle critical SPA/responsive E2E failed.
- The failed E2E assertion is `frontend/e2e/responsive-visual-qa.spec.ts` around line 445: asset action labels must fit their grid cells. The mobile fixed-width sequence passes 320/360/375/390 then fails at 414px; the desktop continuous sweep fails at the same 414px four-column breakpoint. This is a real responsive regression, not a CI infrastructure failure.
- The failing workflow uploaded artifact `15244462914` (`btcbox-mobile-responsive-qa`). The 320px screenshot shows the two-column controls visually inside the card; the failing 414px assertion is about label width/geometry.
- Combined commit status has Vercel success only; this does not override the failed Frontend Actions run.

### AI 2 Web App/Admin fix in this branch
- File `frontend/src/features/assets/AssetsPage.tsx`: keep two columns below 400px and four columns from 400px; for the compact four-column layout, reduce horizontal button padding and icon/gap dimensions while retaining the 44px minimum hit-area height.
- File `frontend/e2e/responsive-visual-qa.spec.ts`: keep the no-clipping/no-overflow assertion, add explicit 44px hit-area verification, and include label width and bounding-box measurements in failure output. The test is strengthened, not weakened.
- Code/test commit after the two frontend updates: `9b68ccced283412a84f59a46d737a0f99cdd2488`.
- No local checkout was available; local npm/Playwright execution was not performed. The exact-head PR CI is the required verification and remains pending until GitHub reports it.
- The branch's coordination-document update records this run's evidence and the unresolved cross-team risks. The final branch HEAD is reported in the run summary.

### Cross-team unresolved risks retained
- Perpetual close-position: API/DB owner must fix full-close and partial-fill replay ordering, stable close intent, atomic position snapshot, and dedicated shared rate limiting; AI 2 does not modify route/SQL implementation.
- Admin Perpetual market configuration: Admin UI/API/DB owners must define request_id, canonical request hash, exact replay and atomic audit/upsert; do not add a frontend-only field.
- Core/Backend owner must add `FINANCIAL_PERPETUAL_WORKERS_READY=0` to `backend/.env.example` and preserve fail-closed defaults.
- Hosted Supabase schema parity, real staging Email/Google authentication, SMTP, Worker deployment/monitoring, and owner visual sign-off remain NOT VERIFIED.
- PR #136 is CLOSED / NOT MERGED; its prior mocked Auth E2E evidence does not establish hosted provider behavior. Its review noted an auth-config-unavailable path where provider buttons may remain enabled without a restored server session; Web/Auth owner should confirm whether this is already fixed on current main before reusing the patch.

### Next actions and release state
1. Run exact-head Frontend CI on the new Draft PR; inspect the 414px mobile and continuous responsive tests and the uploaded screenshots.
2. If the 414px check passes, verify the rest of the responsive and route suite on that exact SHA; do not infer visual owner acceptance from CI.
3. Hand the Perpetual close replay/rate-limit, Admin request-id, and Worker readiness items to their designated owners.
4. Keep the new PR Draft until all required CI, independent review, visual acceptance, hosted staging checks, and explicit owner approval are satisfied.
5. Release readiness remains NOT READY. No production deployment, Vercel mutation, hosted Supabase write/DDL/RLS/Auth/flag change, database reset, real financial operation, real user/session inspection, or locked trading-page layout change was performed.
