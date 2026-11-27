# BTCBOXCDT AI 協作規則（2026-11-27 更新）

> 本文件是目前整合分支的有效協作規則。若舊 issue、舊測試、舊交接文件與本文衝突，以使用者在 2026-11-23 明確確認的產品要求及本文件為準；不得用過期說明阻止已確認功能。

## 1. 當前工作狀態
- Repository: avali9308-code/btcboxcdt
- 最新 main HEAD（本輪核查基準）：40f9363772b53f274f29c886d6353162c9dc3140。
- 本輪有效整合跟進分支：integration/btcbox-mainline-consolidation-20261127，從上述 main SHA 建立；本輪只允許在此分支更新整合/驗收文件，不直接修改 main。
- PR #102 已於 2026-11-23 合併，head 為 92a32c2d2c40ad8bfd1d53785411d4cdc67424ca，merge commit 為 f6d62d21e94a234044221320158eeab0d230e1f4；它是歷史整合 PR，不再是待驗收 PR。
- PR #67 已於 2026-11-08 合併，head 為 c53fa948a599b560c1319726adfb57be6828b0fa，merge commit 為 fbf301f88c5c19db94ea1546c590667a8818e842。GitHub 實際狀態為 Closed/Merged/Draft=false；任何文件或描述中「PR #67 仍為 Draft」均屬過期文字，不能改變 GitHub 的實際狀態。
- PR #136 是目前另行開啟的認證 E2E 候選，並非 PR #67 或主線整合 PR；其 head/base、CI 和 review 狀態見本文件第 7 節。
- 本階段：處理既有整合缺陷、API/UI 合同差異、測試覆蓋及發布證據；不新增產品功能，不藉機修改鎖定的 Spot 交易頁布局。
- 指定分支 chore/shared-ai-coordination 不存在（GitHub ref 404）。每輪先嘗試該分支；不存在時，以 main 上最新可讀的本文件作為現行協調規則，並記錄此差異。
- integration/btcbox-mainline-consolidation-20261108 不存在。integration/btcbox-acceptance-20261123 已隨 PR #102 合併；integration/btcbox-mainline-consolidation-20261126 已落後最新 main，不再作為本輪基礎。保留歷史分支，不刪除、不強推。
- 不得由本階段觸發正式環境部署、正式資料庫遷移或正式資料修改。生產環境有真實使用者。所有新 PR 在必要 CI、review、驗收和所有者批准完成前必須保持 Draft。
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
任何新的整合 PR 只有在下列項目全部完成後才可提出合併：
- 前端 lint、build、單元測試及 Playwright desktop/mobile 必要測試通過。
- 後端測試、PostgreSQL schema CI、Change Guard 通過。
- Codex review / PR review 中的有效問題已處理。
- 認證、資產、充值/提現、訂單、客服隔離及管理員操作完成交叉核對。
- 遷移順序與執行方式經審查，且不會自動對正式資料庫執行。
- 使用者明確同意合併；正式部署及正式遷移另行確認。



## 7. 2026-11-27 精確 SHA 核查與整合交接

### 7.1 Branch / PR 狀態
- main HEAD：40f9363772b53f274f29c886d6353162c9dc3140。
- 本輪分支：integration/btcbox-mainline-consolidation-20261127，建立基點為 main 的上述 SHA；本輪提交僅更新本協調文件，不包含應用程式、SQL、Auth、Vercel 或資料庫變更。
- 本輪第一筆協調文件提交（整合證據更新）：6d6ff75dd3e0e0b900af6a1775e59fa6d5cadeb5；最終文件提交 SHA 以本分支最新 HEAD 為準，並在本輪交接報告列明。
- 舊分支 integration/btcbox-mainline-consolidation-20261126 HEAD：987f15eac36ccf035206cd4f40fabeecea8dc45d；相對最新 main 為 ahead 2 / behind 33，兩個獨有提交僅修改 docs/AI_COORDINATION.md。該 SHA 的 Actions workflow runs 為 0；唯一 check run 是 Supabase Preview 139681273990，結果 skipped。不要將它當作最新整合基礎。
- integration/btcbox-acceptance-20261123 HEAD：92a32c2d2c40ad8bfd1d53785411d4cdc67424ca；PR #102 已合併至 main。
- integration/btcbox-mainline-consolidation-20261108：ref 不存在。
- PR #67：Closed/Merged=true/Draft=false；head c53fa948a599b560c1319726adfb57be6828b0fa，merge commit fbf301f88c5c19db94ea1546c590667a8818e842，review submissions 為 0。該 head 的 Backend 42498936887、PostgreSQL schema 42498936856、Frontend 42498936859 全部成功；4 個 check runs 中另有 Vercel Preview Comments 成功，combined Vercel status 成功。這是歷史 CI 證據，不代表 hosted schema 或正式認證已驗收。
- PR #102：Closed/Merged=true；head 92a32c2d2c40ad8bfd1d53785411d4cdc67424ca，merge commit f6d62d21e94a234044221320158eeab0d230e1f4；review submissions 為 0。PR 描述內的待驗收/未合併文字已過期。

### 7.2 最新 main 的精確 CI
以下均對應 main SHA 40f9363772b53f274f29c886d6353162c9dc3140：
- Backend CI run 45924550650：success；job 140262737236 的 build、backend tests、backend/frontend integration tests、fail-closed deployment preflight、unified output checks 全部成功。
- Frontend CI run 45924550662：success；job 140262737056 的 lint、locale dictionaries、visual standard、exact decimal、production build、production-bundle Playwright critical routes/responsive checks、responsive screenshot upload 全部成功。
- Change Guard run 45924551103：success；job 140262738213 成功。
- Supabase Preview check 140262872610：success。此 check 不等同完整 hosted schema parity、Auth provider、SMTP 或 staging 登入驗收。
- Combined Vercel status：success。
- 最新 main 沒有獨立 PostgreSQL Schema CI workflow run；不可把歷史 PR 的 schema CI 當成此 SHA 的 schema 驗證。

### 7.3 PR #136 認證 E2E 候選
- PR #136 為 Open、Draft=false、Merged=false；head 1384b483e7fb013d55b2dff4534883ba54d94fdf，base SHA 676681f7ff90c5b4b6928dc448ad6a653bfdadba。
- 相對本輪 main 40f9363772b53f274f29c886d6353162c9dc3140，PR head ahead 9 / behind 57；GitHub 回報 mergeable=false。Review submissions 為 0。不可因舊 head CI 通過而合併；PR 負責人須先以最新 main 更新分支，再重跑 CI 並取得 review。
- 精確 PR head 的 Backend 45795229845、Frontend 45795229862、Change Guard 45795229906 全部 success；Supabase Preview check 139824022532 skipped。Frontend job 139824063535 的新增認證 E2E step 成功，並完成 production build、路由及 responsive QA。
- PR #136 修正確認郵件註冊測試讀取錯誤欄位：目前 main 的 frontend/src/lib/api.ts 第 908 行送出 supabase_access_token，而 main 的 frontend/e2e/auth-routes.spec.ts 仍讀取 access_token。PR #136 改為 supabase_access_token。
- PR #136 亦將註冊及 recovery 測試改為經 Supabase SDK 產生 PKCE verifier，新增 Google OAuth PKCE callback/session provisioning 與既有 Google-linked identity 使用 recovery updateUser 設定密碼的 mock browser tests，並把 auth error 顯示改用 main 已存在的 friendlyAuthErrorMessage。
- 上述 E2E 使用攔截/mock Auth 回應；不能證明 hosted Supabase Email/Google provider、SMTP 寄送或真實 identity linking 已成功。PR #136 的改動尚未進入 main；應由 PR 負責人 rebase/更新後重新驗證，不要從落後 57 個提交的分支盲目覆蓋最新檔案。

### 7.4 Perpetual SQL/API、權限與幂等性
- 已修正的舊風險：目前 main 的 0041_perpetual_contract_v1.sql 與 0051_perpetual_market_min_notional_v1.sql 均在重放比較中核對 reduce_only、close_position、quantity、price 等原始意圖欄位；backend/tests/perpetual-sql-contract.test.js 有專門斷言。不得再把「SQL 未比較 reduce_only/close_position」列為現行缺陷。
- 仍未修正的 close-position 重試缺口：backend/api-core.js 第 3669 行附近先讀取 perpetual_positions；無倉位即提前回 NO_POSITION，沒有先按 user_id + client_order_id 查詢已存在訂單。部分成交後又以當前剩餘 quantity 呼叫 perp_submit_order，而 SQL 重放會比較原始 quantity，可能得到 payload mismatch。backend/tests/perpetual-api-contract.test.js 目前只檢查 reduce-only、market order、方向及 NO_POSITION，未覆蓋全平後重放、部分成交後重放或並發重試。
- close-position 路由未見 rateCheckShared；普通下單及撤單有 spot_order / spot_cancel 限流。API/DB 負責人應設計穩定 close intent、先重放後讀取倉位的原子合同，補專用 shared rate limit，並測試限流服務故障時 fail closed。2號 AI 不修改路由或 SQL 實作。
- 現有 API 權限保護：close route 要求登入、拒絕 frozen user，並要求 perpetualEngineEnabled；該函數同時要求 FINANCIAL_PERPETUAL_ENGINE_ENABLED=1、FINANCIAL_PERPETUAL_WORKERS_READY=1 及 financialWritesEnabled()。這是源碼/測試合同證據，不代表生產旗標已開啟。
- Admin Perpetual market request 幂等仍缺：frontend/src/features/admin/AdminPage.tsx 的 saveAdminPerpMarket 呼叫未傳 request_id；frontend/src/lib/api.ts 的 saveAdminPerpMarket input type 亦未定義 request_id。backend/api-core.js 的 admin/perpetual/market 目前寫 audit/outbox 後再直接 upsert perpetual_markets，未見與 Spot/Seconds 相同的持久 request-id + request-hash + replay RPC。Admin route 仍要求 system_config.write，並強制市場 status=paused。由 Admin UI、API、DB 負責人聯合定義合同；2號 AI 不單獨加一個後端不識別的 request_id 欄位。
- Funding worker 的舊「逐用戶部分成功後仍推進週期」風險已由 0046_perpetual_funding_atomic_clearing_v1.sql 的 perp_settle_funding_market 改為 market advisory lock、鎖定市場及所有倉位、任一結算結果失敗即 raise、成功後才標記 rate settled 並推進 next_funding_at；perp-funding-worker 呼叫單一 RPC，任何市場失敗會非零退出。不得重複列為未修復項。
- Liquidation worker 使用完整 REST pagination；REST/RPC 失敗不轉成空倉位列表，stale mark 會暫停該倉位並以非零 exit code 告警。Worker runtime 文件要求 always-on container、restart policy、log/alert routing 及四個 worker loop 成功後才可設 readiness。這些是程式/文件證據，不代表 worker 已部署。
- backend/.env.example 目前只有 FINANCIAL_PERPETUAL_ENGINE_ENABLED=0，缺少 FINANCIAL_PERPETUAL_WORKERS_READY=0 範例；backend/docs/perpetual-worker-runtime.md 已定義 readiness 操作閘門。由 Core/Backend 負責人補齊預設關閉的範例與部署檢查。

### 7.5 Responsive、route 與 release readiness
- main 的 frontend/e2e/responsive-visual-qa.spec.ts 包含 mobile widths 320/360/375/390/414/430/600、desktop widths 768/1024/1279/1280/1366/1440/1920，並對多個頁面做 320–1920 的密集連續寬度掃描；Contract/Perpetual、Spot、資產、充值、提現、Convert 等路由有明確檢查。
- main Frontend CI 已在 production build 後執行 Playwright critical route/responsive checks 並上傳 responsive screenshots；不得改回 vite dev，也不得為通過測試改動鎖定的 Spot 交易頁布局。CI screenshot 不等同所有者獨立視覺簽收。
- 本輪 main tree 中沒有 PRE-RELEASE-CHECKLIST.md 或獨立 release checklist；現存文件包括 BTCBOX-UI-VISUAL-STANDARDS-V1.md、OPEN-ISSUES-AND-OWNER-HANDOFF-2026-11-23.md、PR-116-PERPETUAL-INTEGRATION-REVIEW-2026-11-24.md 及 perpetual-worker-runtime.md。後兩份歷史 review/交接含有已被目前 0051 等遷移和現行程式取代的描述，使用前須對照最新 main；不可將舊 PR-116 blocker 當成現況。
- 發布狀態仍為 NOT READY：close-position 重試/限流未解；Admin Perpetual request-id/replay 合同未完成；worker readiness env example 未補；PR #136 尚未基於最新 main 重驗且無 review；hosted Supabase 完整 schema parity、真實 staging Email/Google 登入、SMTP、worker 實際部署/監控及所有者獨立視覺簽收均 NOT VERIFIED。main CI 全綠不能替代以上證據。
- 本輪沒有 merge PR、production deployment、Vercel 修改、hosted Supabase DDL/DML/RLS/Auth/flags 修改、真實金融操作或真實使用者/session 資料存取。

### 7.6 本輪下一步及責任人
1. PR #136 負責人（Web/Auth）：基於最新 main 更新 PR，保留 supabase_access_token 合同、真實 SDK PKCE verifier、Google OAuth 與 Google-linked recovery 覆蓋；重新跑 Frontend/Backend/Change Guard，並取得 review。
2. API/DB 負責人（路由/3號 AI）：修復 close-position 全平/部分成交重試及 shared rate limit，增加 API/SQL 並發、payload mismatch、fail-closed 測試。
3. Admin UI/API/DB 負責人：為 Perpetual market config 定義 request_id、canonical hash、精確 replay 與原子 audit/upsert 合同；保留 system_config.write 和 paused 狀態。
4. Core/Backend 負責人：在 backend/.env.example 加入 FINANCIAL_PERPETUAL_WORKERS_READY=0，並保持預設關閉。
5. 集成負責人：每次以最新 main 建立/更新整合分支，記錄精確 HEAD、該 SHA 全部 Actions/check-runs、未解風險及下一責任人；未取得必要 CI、review、驗收及所有者批准前，不合併、不部署、不遷移正式資料庫。

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
