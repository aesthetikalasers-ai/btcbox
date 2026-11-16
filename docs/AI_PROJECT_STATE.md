# BTCBOX — 项目交接状态（最新续接摘要）

**更新日期：** 2026-11-16
**仓库：** `avali9308-code/btcboxcdt`
**当前阶段：** 阶段 1（认证弹窗）开发中 — **尚未验收**

---

## 0. 会话交接摘要（新对话请从这里开始）

### 分支与基线
- 开发分支：`working`（本地已检出并跟踪 `origin/working`）
- 本次改动前基线 SHA：`e05f429a0c209c38ad45f20a17425ef9d4c690f9`
- `origin/main` = `910d7f1ea270d995f1c065c9f0a69ddff141310a`
- `main` 与 `working` 代码树一致（仅文档提交差异）。**未修改 / 未推送 / 未合并 `main`，无部署，无真实资金操作。**
- 改动**已提交**到 `working`：commit `cd10b7f7a03d023541ef4a54b28c621312c1056e`（仅本地，**未推送**）。

### 本次已完成并已验证
| 事项 | 结果 |
|---|---|
| 阅读 4 份 AI 文档（COORDINATION / EXECUTION_PLAN / PROJECT_STATE / STATUS_TEMPLATE） | 完成 |
| 基线 `npx tsc --noEmit` | PASS |
| 基线 `npm run build` | PASS |
| `npm install`（仓库无 lockfile，138 packages） | 完成 |
| Playwright chromium 安装 | 完成 |
| 新建 `features/auth/AuthFormPanel.tsx`（统一表单：Email 登录/注册、Google、Wallet、忘记密码、用户名高级登录） | 完成 |
| 新建 `features/auth/AuthDialog.tsx`（Radix 弹窗，可开关/切换/关闭保留上下文） | 完成 |
| 新建 `lib/auth-dialog.tsx`（`AuthDialogProvider` + `useAuthDialog`） | 完成 |
| 拆分 `features/auth/AuthCallbackPage.tsx` | 完成 |
| `features/auth/AuthPages.tsx` 改为复用共享表单的兼容壳 | 完成 |
| `components/layout/Topbar.tsx` Sign in / Create account 改为开弹窗 | 完成 |
| `App.tsx`：`SignInPrompt` 开弹窗；`/login`、`/register` → `AuthRouteEntry`（开弹窗并回首页） | 完成 |
| `features/admin/AdminPage.tsx` 登录改用 `AuthFormPanel redirectTo="/admin"` | 完成 |
| 8 个语言文件（en/ja/zh-CN/es/pt/it/de/vi）新增 19 个 key | 完成 |
| 改动后 `npx tsc --noEmit` | PASS |
| 改动后 `npm run build` | PASS（✓ built in 16.07s） |
| 改动后 `npm run check:i18n` | PASS（1439 keys；0 missing / 0 duplicate / 0 未登记） |

### 已修复的严重缺陷（务必记住）
**白屏事故**：`AuthDialogProvider` 最初放在 `main.tsx` 中 `App` 外层，但 `useAuthDialog()` 的使用方（`SignInPrompt`）位于 `I18nProvider` 内部，导致 `useI18n must be used inside I18nProvider` 整页白屏。
**修复**：将 `AuthDialogProvider` 移入 `App.tsx`，置于 `I18nProvider` 内部、`Routes` 外层。
**规则**：凡调整 Provider 层级，必须用真实页面探测（Playwright）回归一次，不能只看 build 通过。

### 下一步唯一优先任务（NOT VERIFIED，接续者立即执行）
用 Playwright 实测认证弹窗 6 条验收路径并修复失败项：

```bash
cd /c/Users/Administrator/Desktop/btcboxcdt/frontend
npx playwright test e2e/auth-dialog.spec.ts --project=desktop-chromium --reporter=line
```

测试文件已写好：`frontend/e2e/auth-dialog.spec.ts`
1. Topbar「Sign in」打开弹窗且 URL 不变
2. 弹窗内 Sign in / Create account 原地切换
3. 关闭弹窗仍停留原页面且市场内容仍在
4. 弹窗内 Forgot password 可达并可返回
5. `/login`、`/register` 打开弹窗而非独立全屏页
6. Email 登录不得触发任何钱包 provider 调用

**当前状态**：白屏修复后**尚未重跑** → 全部标记 NOT VERIFIED。

### 已知待处理问题
1. **`e2e/auth-routes.spec.ts` 与阶段 1 要求冲突（NEEDS FIX）**：其中多个用例断言「Email 登录 / 找回密码 / Create account with email 应不存在」（`toHaveCount(0)`），与本阶段「保留 Email 登录注册」矛盾，必然失败，需改写为正向断言。
2. `AuthPages.tsx` 中的 `AuthPage` 已不被任何路由使用，暂保留导出，未验证前不要删除。
3. 本地工作区 `references/btcbox-v33` 显示 deleted，属既有本地状态，**不要提交**。

### 本地服务（可复用）
- dev（热更新）：`http://127.0.0.1:5173`
- preview（构建产物）：`http://127.0.0.1:4174`
- Playwright webServer 端口：`4173`

### 环境要点
- Windows Git Bash；路径用 `/c/...`
- 前端目录：`/c/Users/Administrator/Desktop/btcboxcdt/frontend`
- 产品默认语言为**日语**；E2E 断言英文需通过 `localStorage: btcbox-language=en` 固定

---


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

## 2026-11-16 阶段 0 基线核查记录（本助手：数据库负责人）

### 分支与代码基线
- `main` HEAD（本轮基线核查时）：`910d7f1ea270d995f1c065c9f0a69ddff141310a`
- `working` HEAD（本轮基线核查、状态记录提交之前）：`e05f429a0c209c38ad45f20a17425ef9d4c690f9`
- 本次基线记录提交：`169f0a105c2c2a46552fa5fcf90a0c3c885a1ddf`（仅更新本状态文档）
- GitHub compare 返回：`diverged`，双方各有 7 个独有提交；本次未合并、重置或改写任何分支。
- 前端入口：`frontend/`（React/Vite）；后端/API：`backend/`；数据库 SQL：`backend/supabase/sql/`；后端测试：`backend/tests/`。
- `backend/package.json` 提供 `npm test`、`npm run build`、`npm run test:integration`；部署构建说明以 `backend/README.md` 为准。

### 数据库与 Earn 基线发现
- `backend/supabase/sql/` 当前有 35 个文件；其中 `0001`–`0041` 的正式初始化 allowlist 及退役编号规则记录在 `MIGRATION-ORDER-AND-CUTOVER.md`。
- `backend/financial_db.py` 明确说明 Supabase RPC transport 尚不能作为余额权威来源；`backend/financial_storage_guard.py` 目前只允许 `legacy_json`。因此不得将“已有 SQL/RPC”误报为已完成数据库切换。
- `0006_financial_earn_policy_v5.sql` 当前定义 Earn 产品目录、固定产品政策快照、显式 `subscribe_earn_atomic` 与赎回时收益计算；其 demand 产品也通过申购创建 `earn_positions`。现有源代码尚未证明“符合资格的账户持币自动获得活期收益、无需申购”的完整自动计提/入账链路。
- `0011_financial_read_api_earn_v1.sql` 读取的是既有 Earn 持仓记录，不等于自动资格计算或自动收益入账已实现。
- 上述差距属于阶段 2 的 Earn 合同与数据库基础，不在阶段 0 擅自扩展实现；阶段 1 认证弹窗仍按规划先行。

### 数据库环境与安全边界
- SQL 参考文档中的 hosted-schema 统计是 **2026-11-08 的历史只读快照**，不能当作当前实时数据库状态；所有者随后已明确说明现有 4 个 Supabase Auth 账号均为测试账号。当前实时 Auth/表数据、管理员关联和备份状态均 **NOT VERIFIED**。
- 空库 bootstrap 仅适用于确认无 BTCBOX 表的全新数据库；不得用于当前 hosted 项目，不执行生产清理、bootstrap、迁移或资金写入。
- 本次只读仓库源码与文档；未调用 Supabase 写操作，未修改 SQL、应用代码或环境变量，未部署。

### 阶段 0 验收状态
- 代码入口及数据库文件位置：**PASS（仓库源码静态核对）**。
- 分支 HEAD 与分叉状态：**PASS（GitHub refs/compare 已读取）**。
- 本地构建、后端测试、PostgreSQL 隔离 dry-run：**NOT VERIFIED**（本轮没有可执行的仓库工作区/测试运行环境；GitHub 当前 working HEAD 未返回 CI status 或 workflow runs）。
- 阶段 0 总体：**进行中，退出条件尚未全部满足**。不能宣告阶段 0 通过。
- 下一项唯一优先任务：在可执行的 working 工作区运行 `npm test --prefix backend` 与 `npm run build --prefix backend`，记录基线结果；前端 AI 继续阶段 1，本助手不改动其负责的前端文件。

## 2026-11-16 Supabase 实时只读核查补充（本助手：数据库负责人）

### 核查对象与数据状态
- Supabase 当前唯一可见项目：`zlozsutefnmgwwzrlipt`（ACTIVE_HEALTHY，Postgres 17.11）；本次仅执行只读查询与 Advisor 查询。
- 当前实时统计：public 基础表 39 张；Auth 用户 0；`btcbox_state` 1 行；Earn 产品目录 7 行；Earn 持仓 0 行；`financial_accounts` 0 行；`financial_operations` 0 行；`financial_ledger` 0 行；`financial_audit_log` 18 行。
- 备份 schema `btcbox_rebuild_backup_20261116` 当前包含 37 张表。不得因 Auth 用户为 0 就把数据库认定为空库；业务状态表、审计表、产品目录及备份仍存在。
- Earn 产品目录现有 7 项：USDT/BTC/ETH 的 demand 配置及 USDT 30/90/180 天 fixed 配置；本轮没有修改任何产品参数。
- 当前已记录的 Supabase migration history 至少包含 23 项，最新为 `20261116064230 btcbox_auth_user_bootstrap_rpc_v1`；其中 2026-11-16 钱包账户、混合钱包密钥保险库、用户同意/授权、外部钱包验证、钱包账本完整性等迁移已在 hosted 项目记录中。

### 权限只读核查
- `earn_product_catalog`、`earn_positions`、`financial_accounts`、`financial_operations`、`financial_ledger` 与所抽查钱包表均启用 RLS。
- 上述抽查表没有直接授予 `anon` 或 `authenticated` 表级权限；受检 Earn/金融 RPC 的 EXECUTE 授权为 `service_role`（另有数据库 owner），未发现给 `anon`/`authenticated` 的直接 EXECUTE 授权。
- Advisor 报告存在大量 “RLS enabled, no policy” INFO 项；对本轮抽查的财务表，当前访问依赖 service-role RPC 而不是用户端直连策略。此设计仍须在完整 API 路径验收时确认，不能把 INFO 项一律当成安全漏洞或一律忽略。
- 健康 Advisor 本次没有返回 health lint 项；性能 Advisor 返回 unused-index INFO 项，不在当前阶段删除索引。

### 发现的仓库/数据库版本控制差异
- hosted migration history 已包含上述 2026-11-16 钱包相关迁移，但 `working` 仓库的 `backend/supabase/sql/` 仍是 35 个 canonical SQL 文件，`backend/supabase/existing-schema-upgrades/` 仅有 1 个文件；本次未在仓库发现与这些 hosted 钱包迁移一一对应的可复现 SQL 源文件。
- 这是数据库可复现性/源码同步风险：hosted schema 已变化，但仓库当前迁移目录未完整体现。不得用新建空库 bootstrap 来掩盖差异，也不得擅自回滚 hosted 迁移。阶段 2 开始前应先从已审核的 migration source/部署记录补齐版本化 SQL，再进行 Earn 数据库扩展。
- `financial_db.py` 与 `financial_storage_guard.py` 当前仍明确禁止切换余额权威到 Supabase；本轮实时查询确认金融账本相关表目前没有用户资金行，但这不等于已完成全链路切换。

### CI 基线补充
- 对本轮文档提交 `38ebf205772e9ebfcb6323109e767af516f29bd8`，GitHub Actions 的 `backend-ci.yml` run 结论为 `failure`，但 jobs API 返回 0 个 job，失败原因 **NOT VERIFIED**；同一提交的 CI Watchdog workflow 为 `success`。不能据此宣称后端测试通过或断言是代码构建失败。
- 本轮仍未在可执行工作区运行 `npm test --prefix backend`、`npm run build --prefix backend` 或 PostgreSQL 隔离测试。

### 阶段 0 更新结论
- 远程分支、代码入口、hosted 数据表/迁移状态及抽查权限：**PASS（只读核查）**。
- 构建/后端测试/隔离数据库测试：**NOT VERIFIED**。
- hosted migration 与仓库 SQL 源码同步：**NEEDS FIX（需在后续数据库阶段先恢复可复现来源）**。
- 阶段 0 总体仍为 **进行中**，不得进入生产写入或宣布阶段验收通过。
- 下一项唯一优先任务：取得可执行的 working 工作区，完成后端基线测试并定位 backend-ci workflow failure 的真实原因；阶段 1 认证弹窗由前端负责人继续推进。



## 2026-11-16 数据库负责人继续核查（只读补充）

### 本轮分支与入口确认
- `main` HEAD：`910d7f1ea270d995f1c065c9f0a69ddff141310a`。
- `working` HEAD：`7cb80f67c2645ed12066f9facfe076b524e5cb09`（本轮开始时读取；其父提交为 `38ebf205772e9ebfcb6323109e767af516f29bd8`）。
- 后端统一 API 入口为 `backend/api/[...path].js` → `backend/api-adapter.js` → `backend/api-core.js`。
- `backend/api-core.js` 的 Earn 订阅/赎回路由要求服务端已识别的 `user`，以 `user.uid` 生成 RPC 的 `p_user_id`，并在调用前检查 `financialWritesEnabled()`、共享限流和幂等请求 ID；未通过切换门禁时返回 503，不回退到 JSON 钱包写入。
- `backend/financial_db.py` 暴露订阅/赎回 RPC transport；`backend/financial_storage_guard.py` 仍只允许 `legacy_json`。数据库存在 RPC 不等于应用已完成 PostgreSQL 余额权威切换。

### Earn 与钱包实时只读复核
- 当前 migration history 返回 23 项，最新为 `20261116064230 btcbox_auth_user_bootstrap_rpc_v1`。
- 当前 `earn_product_catalog` 为 7 行，`earn_positions` 为 0 行；`financial_accounts`、`financial_operations`、`financial_ledger`、`btcbox_wallet_accounts`、`btcbox_wallet_ledger` 均为 0 行。
- 对 `earn_product_catalog`、`earn_positions`、`financial_accounts`、`financial_ledger`、`financial_operations` 及三张 `btcbox_wallet_*` 表：均启用 RLS；`pg_policies` 未返回这些表的策略；逐项验证 `anon` 与 `authenticated` 均无 SELECT/INSERT/UPDATE/DELETE 表权限，`service_role` 有受检表的 SELECT 权限。
- 当前 Earn RPC `subscribe_earn_atomic`、`redeem_earn_atomic` 均为 `SECURITY INVOKER`，ACL 仅允许 `postgres` 与 `service_role` 执行；未发现客户端角色直接执行授权。
- Supabase Security Advisor 的 46 项 `rls_enabled_no_policy` 均为 INFO。对本轮抽查的财务表，RLS + 无客户端表权限 + service-role RPC 是当前访问模式；不应为了消除 INFO 而直接给客户端开放表权限。
- Health Advisor 返回 0 项。Performance Advisor 返回的 INFO 主要涉及备份 schema 无主键及未使用索引；本轮未删除索引、未改备份表。

### CI 结果与阶段状态
- 当前 `working` 最新提交 `7cb80f67c2645ed12066f9facfe076b524e5cb09` 的 CI Watchdog 为 success；该 docs-only 提交没有对应的 `backend-ci.yml` 测试结果。
- 最近可见的 Backend CI run `43828966950`（提交 `38ebf205772e9ebfcb6323109e767af516f29bd8`）结论为 failure，Jobs API 返回 0 个 job；根因仍 **NOT VERIFIED**，不能推断为代码测试失败或通过。
- 本轮没有本地可执行仓库工作区；`npm test --prefix backend`、`npm run build --prefix backend`、PostgreSQL 隔离测试均 **NOT VERIFIED**。
- 阶段 0：远程 refs、API 入口、实时数据库对象/权限抽查 **PASS**；可执行构建/测试 **NOT VERIFIED**；hosted migration 与仓库 canonical SQL 的可复现性差异 **NEEDS FIX**。阶段 0 总体仍 **进行中**，不得进入阶段 2 实施或宣告阶段通过。
- 下一项唯一优先任务：恢复可执行的 `working` 工作区或查明 Backend CI 在无 job 情况下失败的原因，然后运行后端测试与构建；前端负责人继续阶段 1，本助手不改前端文件。

本节仅记录源码和 Supabase 的只读核查；未执行 DDL、数据写入、迁移、Auth 清理、资金操作或部署。


## 2026-11-16 CI 阻塞诊断续记（数据库负责人）

- 本轮开始时远程 main HEAD：910d7f1ea270d995f1c065c9f0a69ddff141310a；working HEAD：72c9cbbaca44a0bbe574c052bffae402d604e614。当前两者读取结果与本节记录时一致。
- 对 working HEAD 的 Backend CI run 43831198025 重新查询：状态 completed / failure，Jobs API 返回 jobs: []，没有可读取的 job 日志或测试步骤。因此失败发生在 job 可见执行之前或 workflow/run 编排层；具体原因仍 NOT VERIFIED，不能归咎于业务测试、Node 版本或 SQL。
- 同一 SHA 的 Check Runs API 返回 test = success，但该 check 对应另一个 CI Watchdog workflow run 43831200194，不是 Backend CI。不能把这个 success 当作 backend tests/build 已通过。
- Supabase Preview check 为 skipped，提示 working 未关联 Supabase Branch；这不等于 hosted 项目迁移失败，也不允许因此对 hosted 数据库直接执行迁移。
- GitHub connector 对 .github/workflows/backend-ci.yml 的路径读取返回内容与目标路径不一致（返回前端 AuthPages 源码，而目录 API 所列文件 SHA/大小为另一对象）。因此本轮无法可靠审阅 workflow YAML 内容，不能安全修复或改写该 workflow。
- 本轮没有修改 workflow、应用代码或 SQL；没有重跑 workflow、没有 DDL/数据写入、没有部署。
- 阶段 0 状态不变：远程 refs 与数据库只读基线 PASS；后端构建/测试 NOT VERIFIED；迁移源文件可复现性 NEEDS FIX；阶段 0 仍未通过。
- 下一项唯一优先任务：取得可靠的 workflow 文件内容或可执行工作区，再定位 Backend CI 无 job 的失败原因并运行后端测试/构建。阶段 1 认证弹窗由前端负责人继续；数据库负责人不越权改其文件。
