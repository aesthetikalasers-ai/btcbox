# BTCBOXCDT 整合問題與責任交接（2026-11-23）

## 狀態基線
- Repository：`avali9308-code/btcboxcdt`
- Branch：`integration/btcbox-acceptance-20261123`
- PR：#102，base `main`，截至本次檢查仍為 open、未合併。
- 已檢查 head：`bdc27b3387746d9ff013eae70f40a8027096a2d7`（後續任何提交後須重新讀取最新 head）。
- 本階段不合併、不部署、不執行正式資料庫遷移；正式站有真實使用者。
- 路由問題由其他 AI 負責，2號 AI 僅記錄接口依賴，不重複改路由。

## 已確認的產品要求
- Google 登入允許。
- 電子郵件註冊允許，並須經 Supabase 郵件確認與 BTCBOX 帳戶初始化。
- 電子郵件密碼登入及忘記/重設密碼允許。
- Google 與郵件相同時應為同一身份、同一 BTCBOX 帳戶；設定密碼不可建立重複 auth.users。
- 未登入仍可瀏覽公開首頁、行情、交易預覽、公告及客服說明；真實資產、私人客服及資金操作須登入。
- 不允許新用戶看到虛構的 10,000 USDT 或紙面餘額。
- 交易中心四入口為 Spot / Seconds / Contract / Earn。
- 以上要求取代任何舊文件或測試中「Google-only」「retired email auth」「email signup forbidden」等相反規則。

## 已查明的整合阻塞
### Frontend CI
- Workflow run：`45120420987`
- Build job：`137512668281`
- 先前執行報告：41 failed、76 passed，Playwright 執行約 15 分鐘。
- 最新一輪提交 `ac52bdf` 已觸發新的 Backend / Frontend / PostgreSQL schema / Change Guard workflow；截至本文件更新時仍在 queue，尚無新結果。
- 此數字是該次歷史 run 的結果，不代表目前 head 的 CI 狀態；每次提交後需重新查最新 workflow。
- 失敗分布包括認證路由、帳戶保護、資產/訂單資料斷言、交易中心產品名稱、首頁/交易頁 i18n、語言選單、客服提示及 K 線時間精度。必須逐個用例核實根因，不能把所有失敗歸類為同一問題。

### 認證實作與測試不一致
- 已在本分支新增 `AuthPages.tsx` 郵箱註冊表單，並在 `auth.tsx` 新增 `signUpWithEmail`：直接呼叫 Supabase Auth `signUp`，以 `/auth/react-callback?intent=register` 作為郵件確認回跳；不經過自建 service-role 註冊接口。需在 lint/build/E2E 及後端身份 provision 測試通過後才能標記完成。
- `frontend/src/lib/auth.tsx` 現已包含 `signInWithEmail`、`signUpWithEmail`、`requestPasswordReset` 和 `completePasswordRecovery`。錯誤映射仍有 `GOOGLE_ONLY_AUTH` 文案，須確認僅代表舊 `/api/register` 直寫路徑被封鎖，不可再作為前端 Supabase 註冊的禁用條件。
- `frontend/e2e/auth-routes.spec.ts` 同時存在「email signup uses Supabase confirmation」和「retired email authentication/recovery」的互相矛盾斷言。
- 不得直接刪除 email 註冊/登入/恢復測試。後端 `/api/register` 仍刻意 fail-closed（防止繞過郵箱確認及 service-role 直接建戶）；正式郵箱註冊應走 Supabase 公開 Auth `signUp`，確認郵箱後由現有 `/api/supabase-login` 驗證身份並初始化 BTCBOX 帳戶。已更新 `backend/tests/google-only-auth.test.js` 和 `backend/tests/spot-trading-live-refresh.test.js` 中 3 項禁止 `signUpWithEmail` 的舊斷言，改為要求 Supabase email signup 存在；這些測試仍需最新 Backend CI 證明通過。不可為了開放註冊而開啟 `/api/register` 直寫。

### 語言字典核對
- `frontend/src/lib/locales/vi.json` 在整合分支曾缺失，但 `check-i18n.mjs` 仍要求保留。已從主線恢復並補齊至 1,806 keys；目前 7 種語言可在 UI 選擇，越南語字典保留但語言入口仍按現有規格隱藏。
- 已將 `npm run check:i18n` 加入前端 CI，需由新 run 證明 8 份字典、靜態 `t()` key 與保留字典檢查通過。

### 文件缺口
- 本分支目前沒有 `docs/` 目錄；舊的 `docs/AI_COORDINATION.md` 與 `docs/OPEN-ISSUES-AND-OWNER-HANDOFF-2026-11-04.md` 在目前分支不可讀取。
- 本交接檔與 `docs/AI_COORDINATION.md` 作為本分支最新有效協作說明。其他 AI 不應因找不到 11-04 舊文件而停止工作；應閱讀本文件及最新 PR/CI 狀態。
- 若歷史分支仍含舊文件，勿將舊文件直接複製回來覆蓋本次更新。

## 2號 AI（Web App + Admin Panel）待辦
1. 逐項取得當前 Playwright 失敗用例的完整錯誤、fixture 與實際 DOM/API 行為。
2. 先處理認證功能與測試矛盾：郵箱註冊、郵件確認、callback、BTCBOX provision、email/password 登入、密碼恢復、Google 同郵箱身份一致性。
3. 修正市場 mock 的 schema 與頁面實際 API contract；不得讓假行情進入真實 UI。
4. 核對 Contract/Perpetual 文案、產品入口與四產品規格，統一正確定義而非盲改斷言。
5. 修正 i18n 測試 fixture、語言選擇器與各頁面真實翻譯鍵；不得刪減支援語言或放寬 overflow 驗收。
6. 核對客服多語言提示及客服會話隔離；不得破壞用戶間對話隔離。
7. 核對資產與訂單頁只呈現 API 返回的真實資料；禁止演示餘額。
8. 重新執行 lint/build、相關 Playwright、全量 Playwright，記錄 desktop/mobile 結果。

## 跨角色依賴 / 不得擅改
- 路由實作由其他 AI 負責。
- Supabase schema、auth provider、callback/provision 和後端身份綁定需與 1號/3號核對。
- 真實交易、資金、帳本、充值/提現的服務端業務邏輯不得為通過 UI 測試而改寫。
- 不觸碰正式 Supabase 資料，不執行正式遷移。

## 完成記錄
目前：已恢復協作規則與交接文件；已補上 React Supabase email signup 表單及 provider 方法；新增郵箱確認 callback 後經 `/api/supabase-login` 初始化 BTCBOX 帳戶的 E2E 測試，且確認不呼叫舊 `/api/register`。已更新後端 3 項舊 Google-only UI 斷言；交易中心與首頁入口統一為 Contract。7 份啟用語言字典與恢復的越南語舊字典目前均為 1,806 個鍵。Playwright 已改用 production preview；行情 fixture、客服私有 API、公開 Earn、語言選擇器、OAuth callback 回復、2FA 與 K 線時間測試已修正。最新 head 的 CI 尚待完成，Google/Email 同身份鏈接、真實 SMTP 確認及全套資金/客服驗收仍未完成；不得宣告認證或整體整合驗收通過。
