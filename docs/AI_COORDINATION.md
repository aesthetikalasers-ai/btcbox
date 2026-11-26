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

## 2026-11-26 integration continuation — current-state supersession

> 本節取代本文第 1 節中已過期的分支/PR 狀態，以及歷史段落中對 PR #67「仍為 Draft」的描述。產品、安全、角色和禁止生產寫入/部署的邊界仍有效。這是源碼與 CI 協調記錄，不是生產驗收或部署批准。

### 1. 協調來源與分支

- 本次首先讀取指定 ref `chore/shared-ai-coordination` 的 `docs/AI_COORDINATION.md`；GitHub 回覆 404（ref 不存在）。其後讀取當前 main 的協調文件，Blob SHA：`0ae2655558aaf361e15ace049645ffddb48d80ac`。
- main 最新基線：`156e2571158968d717e8de0e5bbdd84850b6f97d`。
- 使用者指定的 `integration/btcbox-mainline-consolidation-20261108` ref 不存在。
- 上一輪分支 `integration/btcbox-mainline-consolidation-20261125` HEAD：`a3da009a8b3d54b5df05f58b03aedee3c2ebb2e8`；相對最新 main 為 ahead 1 / behind 65，唯一獨有 commit 只修改本文件。該精確 SHA 的 Actions workflow runs 為 0；唯一 Check Run 是 Supabase Preview `138965659706`，結果 skipped；combined status contexts 為空。不要把它當成最新 main 的整合基線。
- 本輪建立 `integration/btcbox-mainline-consolidation-20261126`，直接從 main SHA `156e2571158968d717e8de0e5bbdd84850b6f97d` 建立。沒有修改 main、沒有刪除舊分支、沒有建立 PR 或合併 PR。
- 本節記錄的源碼/測試 Blob SHA：API `249365e2ac1144518ccfd2de832294d7f87df430`；SQL 0041 `b54d6a03a8396896421b68be483e8f2931a69502`；Perpetual API tests `9ca55dac6277ab0afac7f0b4b4e83bbea41a184f`；Admin API tests `7484b15ad8616342039f3e4a4264180321a0c30b`；frontend API client `75347bb938281aefab5f089a91529937ca19e101`；AdminPage `59a5e3805718e6f448edc78782f9d6ebbc78fd80`；responsive E2E `f4ddd354b85a7ee8295f581ce2cc67aca16e3583`；frontend workflow `798842eec99e62529e2c17522f9b8e2495afe1ef`；`.env.example` `18292ce49bb3a11e3e3e855b5744348ab9f082dd`。

### 2. PR #67 / PR #102 的實際狀態（以 GitHub API 為準）

- **PR #67 已 Closed / Merged=true / Draft=false**；head `c53fa948a599b560c1319726adfb57be6828b0fa`，merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`。精確 head 的 Backend CI `42498936887`、PostgreSQL Schema CI `42498936856`、Frontend CI `42498936859` 均 success；check-runs 共 4 個，含 3 個成功的 CI job 和成功的 Vercel Preview Comments `128787370398`。PR review submissions 為 0。PR 已合併，不能再保持 Draft；文件中「PR #67 remains Draft」的歷史要求已被 GitHub 實際狀態取代，沒有嘗試回退或改寫歷史。
- **PR #102 已 Closed / Merged=true**；head `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`，merge commit `f6d62d21e94a234044221320158eeab0d230e1f4`，review submissions 為 0。精確 head 的 Backend CI `45215510605`、PostgreSQL Schema CI `45215510558`、Change Guard `45215510283` success；Frontend CI `45215510322` failure；Supabase Preview `138288668386` skipped。這證實本文原第 1/5 節的「PR #102 尚待 E2E 後合併」已過期，而且該 PR 在 Frontend 失敗、無 review submissions 時仍被合併；後續 PR 必須嚴格遵守 CI、review、owner approval 閘門。

### 3. 最新 main 精確 SHA 的 Actions 與前端驗收

驗證對象：`156e2571158968d717e8de0e5bbdd84850b6f97d`。

- Backend CI `45748027200`：success。Jobs/steps：unified build、backend tests、backend/frontend integration tests、fail-closed deployment preflight、unified output/entrypoint checks 全部 success。
- Frontend CI `45748027164`：success。Lint、locale dictionaries、exact-decimal tests、production build、production-bundle Playwright route/responsive/trade interaction checks、responsive screenshot artifact upload 全部 success。
- Change Guard `45748027192`：success。
- Check Runs 共 4 個：上述 3 個成功的 Actions job，加 Supabase Preview `139677357702` skipped。Combined status 的 Vercel context 為 success。
- 此精確 main SHA 沒有獨立 PostgreSQL Schema CI run；不可把其他 PR head 的 PostgreSQL PASS 當成此 SHA 的 schema run。
- Frontend workflow `.github/workflows/frontend-ci.yml` 在 build 後執行 production preview E2E grep：`@routing`、必要路由的 V1.0 responsive QA、continuous responsive sweep、trade interaction QA、degraded public catalogue，並上傳 mobile screenshot artifact。
- `responsive-visual-qa.spec.ts` 覆蓋 17 個路由（login/register/home/markets/spot/trade-hub/assets/me/settings/support/orders/deposit/withdraw/earn/kyc/contract/seconds）。固定桌面寬度：768/1024/1279/1280/1366/1440/1920；手機寬度：320/360/375/390/414/430/600；連續掃描寬度由 320 至 1920，覆蓋 28 個斷點。Perpetual 在 1280px 以下的雙列欄位斷言維持約 50:50（容差 0.015），並檢查容器非零尺寸及水平溢出。
- 這是精確 SHA 的自動化 production-bundle 測試和 screenshot artifact 成功，不等同真實設備/所有者獨立視覺簽收。

### 4. SQL/API 幂等性、授權及 fail-closed 核對

1. **Perpetual close-position replay 仍不一致，交由 API/DB owner。**
   - `backend/api-core.js` 第 3447 行：route 先驗證已登入 user、帳戶未凍結、`perpetualEngineEnabled()`、symbol 和 client_order_id；之後先讀目前 position。若 position 不存在，於 SQL RPC 前回 `NO_POSITION`；若存在，將當前動態 quantity 傳給 `perp_submit_order`。此 route 沒有 `rateCheckShared`；RATE_LIMIT_POLICIES 也沒有 `perp_close_position`。相鄰普通下單/撤單分別有 `spot_order` / `spot_cancel` shared limit。
   - SQL 0041 第 475 行的 `perp_submit_order` 先以 user+client_order_id advisory lock，再在第 518 行進行 idempotency replay；重放比較 symbol/type/side/leverage/quantity/reduce_only/close_position/price，並在 position 查詢前返回原訂單。新 close request 的 quantity 則在後續 position lock 後才被設為當前 position quantity。
   - 因此全平後同 ID retry 會被 API 的 `NO_POSITION` 提前截斷；部分成交後同 ID retry 會把剩餘 quantity 傳入 SQL，與首次保存的 quantity 不同而觸發 payload mismatch。這是已由當前源碼確認的重放缺口，不是 hosted execution 測試。
   - 現有 `perpetual-api-contract.test.js` 第 95 行只斷言 reduce-only market close、反向 side 和 NO_POSITION；沒有 full-close replay、partial-fill replay 或 close-position rate-limit fail-closed 覆蓋。
   - 建議 API/路由 owner + DB owner：用穩定 close intent 作為重放合同，讓 DB 在同一原子交易內鎖倉/取量/保存結果；重放先返回既有結果；新增 `perp_close_position` shared rate limit，限流依賴不可用時 fail closed；增加 full/partial replay、不同 symbol/intent 重用 ID、並發重試和限流故障測試。2號 AI 不修改路由或 SQL。

2. **Admin Perpetual market upsert 缺少 request-id/hash replay，交由 Admin API/DB owner。**
   - Backend `api-core.js` 第 5077 行的 `perpetual/market` POST 確實要求 `system_config.write`，驗證欄位及必填 reason，並強制 `status='paused'`；這些授權與暫停保護應保留。
   - 但該 handler 先 `auditAdmin('perpetual_market_upsert', ...)`、`saveDB`/flush audit，再直接 PostgREST upsert `perpetual_markets?on_conflict=symbol`；沒有 request_id、canonical request hash 或 durable replay response。若 upsert 成功但回應遺失，重試可能重複產生 audit event；若 upsert 失敗，先寫入的 audit 可能記錄尚未完成的變更。
   - `frontend/src/lib/api.ts` 第 1545 行的 `saveAdminPerpMarket` input 不含 request_id；`AdminPage.tsx` 第 1440 行呼叫亦未傳 request_id。Admin API contract test 第 51 行只驗證 permission、route 和 paused-only form，沒有 idempotency assertions。
   - 對照：Spot market admin flow 已使用 request_id + SHA-256 request hash，並呼叫 `admin_set_spot_market_v1` RPC 返回 replayed。建議 Admin UI/API/DB owner 為 Perpetual market 建立同等 RPC contract：同 ID 同 payload 返回原結果、同 ID 不同 payload 拒絕，market upsert 與 audit 在同一交易內完成。未有後端/DB 合約前，前端不應只單方面增加無效 request_id。

3. **Worker readiness env 示例缺口，交由 Core/Backend owner。**
   - API 的 `perpetualEngineEnabled()` 要求 `FINANCIAL_PERPETUAL_ENGINE_ENABLED=1`、`FINANCIAL_PERPETUAL_WORKERS_READY=1` 和 financial write gate；Perpetual API contract tests 驗證預設關閉及 worker-ready gate。
   - `backend/.env.example` 只有 `FINANCIAL_PERPETUAL_ENGINE_ENABLED=0`，沒有 `FINANCIAL_PERPETUAL_WORKERS_READY=0`。Worker runtime 文件要求專用 always-on container、四個 worker 成功 pass、restart/monitor/alert 驗證後才設定 readiness。建議 Backend owner 補上預設 0 的示例及部署檢查；不代表目前 hosted flag 已知。

4. **已確認的正向保護**
   - Close-position route 有 user authentication、frozen-account gate 和 perpetual engine/financial-write gate；SQL 0041 的 `perp_submit_order` 是 SECURITY INVOKER、空 search_path，並檢查 reduce_only / close_position 的重放意圖。缺口集中在 API 與 SQL 的動態 quantity replay 順序和 route 限流，不應把它描述成已能執行真實金融交易。
   - Admin Perpetual route 有 `system_config.write` RBAC、欄位驗證、必填操作原因和 paused-only 行為；問題是 durable idempotency/audit transaction contract 尚未對齊。

### 5. 發布準備與下一步

- 最新 main 自動化 Backend、Frontend、Change Guard：PASS；Supabase Preview：SKIPPED；獨立 PostgreSQL Schema CI on this exact main SHA：NOT RUN。
- 舊 20261108 integration ref 不存在；20261125 branch 落後 65 commits 且沒有應用代碼變更；新 continuation branch 從最新 main 建立。
- Hosted Supabase full schema parity、Email/Google staging real-login、worker deployment/readiness、production financial flags、真實金融執行、所有者獨立視覺簽收仍 NOT VERIFIED。
- **下一優先順序：** (1) API/DB owner 修復 close-position stable-intent replay + dedicated shared rate limit，補 full/partial retry 和 fail-closed tests；(2) Admin UI/API/DB owner 對 Perpetual market upsert 增加 request_id/hash/replay RPC 與原子 audit；(3) Core/Backend owner 補 worker readiness env example；(4) 在新 integration branch/後續 Draft PR 對精確 HEAD 執行 Backend、PostgreSQL Schema、Frontend production-preview E2E 和 Change Guard，完成 review 與 owner acceptance。
- PR #67 已合併，不能再改回 Draft。任何後續新 PR 必須保持 Draft，直到必要 CI、review、驗收及 owner approval 全部完成。不得合併、部署、修改 Vercel、寫入 hosted Supabase、改 Auth/flags、執行真實金融操作或改動鎖定 Spot 交易頁布局。

### 本次文檔提交的精確 SHA 與驗證

- 本節首個文檔更新 commit：`b6d037f4dbcd81131d3dcd8b04de972e9e936a8e`（parent/source baseline：main `156e2571158968d717e8de0e5bbdd84850b6f97d`）。
- 對該精確 SHA 查詢 GitHub Actions：workflow runs 0；Check Runs 只有 Supabase Preview `139681118357`，結果 skipped；combined status contexts 為空。
- 該提交只修改 `docs/AI_COORDINATION.md`，不觸發本倉庫限定 main/PR 的 Backend、Frontend 或 PostgreSQL workflow；因此不能把它標記為應用 CI PASS。本輪未執行本地應用測試，也未修改應用/SQL。
