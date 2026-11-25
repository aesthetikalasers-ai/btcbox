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


## 2026-11-25 integration continuation — current-state supersession

> 本節更新並取代本文件第 1 節中已過期的分支/PR 狀態；第 2–6 節的產品、安全、角色及合併/部署邊界繼續有效。這是協調與源碼審查記錄，不是生產驗收或部署批准。

### 1. 協調來源、基線與分支

- 本次先嘗試讀取指定 ref `chore/shared-ai-coordination` 的 `docs/AI_COORDINATION.md`，GitHub 回覆 404（ref 不存在）。
- 因此讀取當前 `main` 的 `docs/AI_COORDINATION.md`，Blob SHA：`0ae2655558aaf361e15ace049645ffddb48d80ac`；此文件是本次採用的最新可讀協調規則。較舊 `working` 版本日期為 2026-11-16，不覆蓋 main 上 2026-11-23 的規則。
- 當前 main 基線：`32c8788976cb9d9971b072c01db1430e13ed69fa`。
- PR #102 所用 `integration/btcbox-acceptance-20261123` 已合併且落後 main 321 commits；舊 `integration/btcbox-mainline-consolidation-20261108` ref 已不存在。
- 先前 `integration/btcbox-acceptance-20261124` HEAD 為 `cff30c85377b7e0eefb00726cbad1630e9f05ec1`，相對當前 main 落後 222 commits；精確 SHA 的 Actions runs 為 0，唯一 Check Run 是 Supabase Preview skipped。不得把它當成當前整合基線。
- 本次建立接續整合分支 `integration/btcbox-mainline-consolidation-20261125`，從 main SHA `32c8788976cb9d9971b072c01db1430e13ed69fa` 起始。僅更新本協調文件，沒有修改應用、API、SQL 或交易頁。

### 2. PR #67、#102 及舊整合線的實際狀態

- PR #67：Closed、Merged=true、Draft=false；HEAD `c53fa948a599b560c1319726adfb57be6828b0fa`，merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`。舊 head 的 Backend CI `42498936887`、PostgreSQL Schema CI `42498936856`、Frontend CI `42498936859` 均 PASS；精確 head 的 4 個 Check Runs 均成功（含 Vercel Preview Comments）。merge commit 的 3 個 CI Check Runs 亦均 PASS。PR review submissions 為 0。PR body 中「仍為 Draft」的歷史文字已過期；PR 已合併，不能再保持 Draft，也沒有嘗試回退。
- PR #102：Closed、Merged=true；HEAD `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`，merge commit `f6d62d21e94a234044221320158eeab0d230e1f4`。精確 head 的 Backend CI `45215510605` PASS、PostgreSQL Schema CI `45215510558` PASS、Change Guard `45215510283` PASS，但 Frontend CI `45215510322` FAIL；失敗步驟是 production bundle 的 mobile route/core-flow Playwright，lint、i18n、decimal、build 均通過。PR review submissions 為 0。這是合併閘門未被遵守的流程偏差，不能因後續 PR 通過而改寫歷史。
- PR #113：Closed、Merged=true；精確 head `054384739bef4a7cfa517fa8b654e88ce6421387` 的 Frontend CI `45362786944`、PostgreSQL Schema CI `45362787010`、Change Guard `45362787284`、Backend CI `45362787299` 全部 PASS；review submissions 為 0。Frontend workflow 的 production-bundle Playwright step 覆蓋 `@routing`、V1.0 responsive widths、continuous responsive sweep、trade interaction QA，並成功上傳 screenshot artifact。這是自動化技術驗證，不等同所有者視覺簽收。
- PR #114、#116、#117、#119 的精確 head 亦有對應 CI 證據：#114 HEAD `78dd45da459d475a0dcc8ed2edce9a214e5b5dbc` 的 Backend/Change Guard/PostgreSQL 均 PASS；#116 HEAD `78ccb1408e27fe24b399caf2ed1f56cc16e7e762` 的 Backend/Frontend/Change Guard/PostgreSQL/Exchange-filter-audit 均 PASS（Supabase Preview skipped）；#117 HEAD `92c6be1f273660f9b922e88b6a8b00665f29f7b5` 的 Backend/Change Guard/PostgreSQL 均 PASS；#119 HEAD `674820e425cf0effeffe13d7c816c639049e20c0` 的 Backend/Change Guard/PostgreSQL 均 PASS。這些是各 PR head 的驗證，不宣稱 hosted Supabase 已與所有 migration 同步。
- PR #67 的「保持 Draft」要求已被 GitHub 實際合併狀態取代；後續整合工作應保持新 PR Draft，直到當前 CI、review、驗收及所有者批准均滿足。

### 3. 當前 main 精確 SHA 的 CI

驗證對象：`32c8788976cb9d9971b072c01db1430e13ed69fa`。

- Backend CI `45476412273` PASS：backend dependencies、unified build、backend tests、backend/frontend integration tests、fail-closed deployment preflight、unified output/entrypoint checks 均成功。
- Frontend CI `45476412162` PASS：lint、`npm run check:i18n`、exact-decimal tests、build、production-bundle Playwright route/responsive/trade-interaction QA、screenshot upload 均成功。
- Change Guard `45476412141` PASS。
- Scheduled mirror sync `45510704490` PASS。
- Check Runs 共 5 個：上述 4 個成功，Supabase Preview `138750188728` skipped。
- Combined commit status 的 Vercel context 為 success。
- **此 exact main SHA 沒有獨立 PostgreSQL Schema CI run**；最近相關 PR head 的 PostgreSQL Schema CI（#113/#114/#116/#117/#119）均 PASS。不得將 PR head 的 schema PASS 說成 main SHA 的獨立 schema run。
- 另有開放 PR #131（HEAD `c4d377bd25617afa0a4b966dbcebe119c22a77f6`）：Change Guard PASS、Frontend CI PASS、Backend CI `45480428308` FAIL（backend tests 步驟失敗）。該 PR 尚未合併，不屬於本次變更範圍。

### 4. 當前 main 的 SQL/API 合約核對

- 當前 main 的規範 migration 序列包括 `0041_perpetual_contract_v1.sql`、`0046_perpetual_funding_atomic_clearing_v1.sql`、`0047_perpetual_liquidation_accounting_closure_v1.sql`、`0048_perpetual_funding_rate_producer_v1.sql`、`0049_btcbox_complete_26_asset_registry_v1.sql`、`0050_perpetual_bootstrap_mark_price_v1.sql`、`0051_perpetual_market_min_notional_v1.sql`、`0052_perpetual_two_source_median_bootstrap_v1.sql`、`0053_perpetual_two_source_live_mark_v1.sql`。舊 integration 線的 0042–0044 編號/內容不是當前 main 的 canonical migration 序列；不可從落後分支盲目 cherry-pick。
- `0051` 已明確將既有 perpetual market rows 設為 `enabled=false,status='paused'`；order RPC 對非 reduce-only 開倉拒絕非 `trading/open_only` 狀態；reduce-only 可在 paused/liquidation-only 狀態執行；缺少正數 `max_position_notional` 時開倉 fail closed。當前 `perpetual-sql-contract.test.js` 有對 paused cutover、max exposure cap、reduce-only、close-position flag idempotency 的源碼合同斷言。
- 因此 `docs/PR-116-PERPETUAL-INTEGRATION-REVIEW-2026-11-24.md` 中「0051 未將既有 market 暫停」「liquidation-only 阻止 reduce-only」「max cap guard 不可達」三項靜態阻塞，已被當前 main 的 0051 實際內容修正；該 review 文件這三項結論已過期。仍須保留它對全 RPC 重寫、撮合 maker/taker、部分成交、撤單、margin/ledger invariant 的測試提醒。
- Funding worker 現在以單一 `perp_settle_funding_market` RPC 原子結算市場，檢查 REST/RPC HTTP 狀態，遇到市場失敗會非零退出；funding rate producer 是獨立的 snapshot 生產程序，不直接改餘額。Liquidation worker 使用有界分頁，REST 讀取錯誤不會被當成空倉位。Worker runtime 文件要求 dedicated always-on container，四個 worker 成功完成 pass、監控/告警驗證後才設定 `FINANCIAL_PERPETUAL_WORKERS_READY=1`；API 寫入還要求 `FINANCIAL_PERPETUAL_ENGINE_ENABLED=1` 及完整 financial Postgres cutover。沒有證據證明該 container 已部署或 production readiness flag 已開啟。
- `backend/.env.example` 有 `FINANCIAL_PERPETUAL_ENGINE_ENABLED=0`，但沒有列出 `FINANCIAL_PERPETUAL_WORKERS_READY=0`；建議 Core/Backend owner 補上預設關閉的文件示例，避免部署人員漏掉 API 的第二道 gate。這是文件/配置示例缺口，不代表 hosted flag 狀態已知。

### 5. 尚未解決的跨團隊風險（本次只記錄，不越權修改）

1. **Perpetual close-position API 幂等重試與限流**：當前 `backend/api-core.js` Blob `964cba213d25d3e40963fa651038954d6a1ab20e`，第 3180–3199 行先讀當前 position；無倉位就於 SQL RPC 前回 `NO_POSITION`；有倉位則把當前動態 quantity/side 傳給 `perp_submit_order`。全平倉後的相同 client_order_id 重試會被提前擋下；部分成交後 quantity 改變，可能與原始 order payload mismatch。此 route 也沒有像 order/cancel 一樣顯式呼叫 `rateCheckShared`。現有 `perpetual-api-contract.test.js` 只斷言 NO_POSITION 與 reduce-only/close-position 參數，沒有覆蓋全平/部分成交後同 ID replay，也沒有 close-position rate-limit fail-closed 測試。路由由其他 AI 負責，2號 AI 不修改 route；建議 route owner 與 DB owner 設計以穩定 close intent 為基礎的重放合同（最好由 DB 原子鎖倉、取量、保存結果），加入 `perp_close_position` shared rate limit，並測試 full-close replay、partial-fill replay、不同 symbol/intent 重用 ID、限流服務不可用。
2. **Perpetual admin market upsert 缺少 request-id replay contract**：前端 `saveAdminPerpMarket` 的型別/請求不含 `request_id`；後端 `POST admin/perpetual/market` 以 symbol upsert，強制 `status='paused'`、要求有界 reason 並做 `system_config.write` 權限檢查，但沒有 durable request-id/hash/replay response。重試會保持 market 最終值（symbol upsert），但可能重複寫 audit event/更新時間。建議 Admin UI/API owner 一起加入 request_id、canonical request hash、同 ID 同 payload replay、同 ID 不同 payload reject，保留 audit reason 與 paused-only 行為。
3. **Worker readiness 示例**：`perpetualEngineEnabled()` 要求 `FINANCIAL_PERPETUAL_WORKERS_READY='1'`；`.env.example` 未列其預設值。由 Core/Backend owner 補齊文件與測試。Worker runtime 文檔所述「先部署並驗證 workers，再設 readiness」是既定運行順序，不可把 worker 尚未部署說成已驗收。
4. **管理流程**：PR #102 在 Frontend Playwright 失敗且沒有 review submissions 的情況下仍被合併。後續 PR #113 的 route/responsive CI 已通過，但沒有 review submissions。未來新 PR 必須遵守本文件第 5 節的全部 CI/review/owner approval 閘門。
5. **驗收邊界**：目前只證明源碼、PR CI 及 disposable PostgreSQL 的相應測試。Hosted Supabase 全 schema parity、Email/Google staging 真實登入、production worker deployment/readiness、production financial flags、真實金融執行、所有者獨立視覺簽收仍為 NOT VERIFIED。

### 6. 下一步唯一優先工作

- **API/路由 owner + DB owner**：先修正 close-position 穩定幂等重放合同與 shared rate limit，增加 full-close/partial-fill replay 及限流 fail-closed 測試。
- **Admin UI/API owner**：為 perpetual market config upsert 加 request-id/hash replay，避免操作回應丟失後產生重複 audit。
- **Core/Backend owner**：將 `FINANCIAL_PERPETUAL_WORKERS_READY=0` 補入 env 示例與部署核對，並保留獨立 worker runtime 驗收。
- **整合驗收**：在當前 main 衍生分支執行對應 Backend、Frontend production-preview Playwright 及 disposable PostgreSQL schema/integration tests；每個 PR 必須以精確 HEAD SHA 核對所有 CI。
- 未經所有者批准不合併、不部署、不修改 Vercel、不對 hosted Supabase 執行 DDL/DML/Auth/flags、不執行真實金融操作、不改動鎖定交易頁布局。整體狀態仍為 **NOT READY**。
