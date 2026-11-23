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


## 2026-11-17 阶段 0 基线与集成分支复核（数据库负责人）

### 正式规则与分支状态
- 已尝试读取用户指定的 `chore/shared-ai-coordination`，该分支当前无法解析；分支搜索未找到该名称。以最新正式基准 `main` 上的 `docs/AI_COORDINATION.md` 为准（blob `190ab6ecf712dde2df62109692514e6cab1e431f`）：唯一基准为 `main`，唯一共同开发分支为 `working`；数据库 AI 负责 Supabase schema、migrations、RPC、钱包账本完整性及 Earn/钱包数据库基础。不得创建长期集成分支、直接推送 main 或未经批准合并/部署。
- 本轮核实的 HEAD：`main=dc7268c73b8fa4370790160e2f882bc19e4d7226`；`working=06f468c1856b2b2917fd98aa43da1206f74bb702`。GitHub compare：main 领先 working 44 个提交，working 有 16 个独有提交，双方已分叉；未同步、重置或改写。
- 用户指定的 `integration/btcbox-mainline-consolidation-20261108` 当前不存在（分支搜索无结果，compare 返回 404），因此没有可核实的该分支 HEAD 或 CI。
- 另一个历史候选 `integration/btcbox-mainline-consolidation-20261116` HEAD 为 `e6999067fe6e7500ce2279d7c0535aeb33e646d8`；相对 main 为 11 ahead / 57 behind，已严重落后。该分支不是当前正式共同开发分支，本轮只读检查，没有继续写入。

### PR #67 与精确 SHA 证据
- GitHub PR 搜索：PR #67 未出现在 open 结果，出现在 closed 结果；因此当前不能称其为 open Draft。连接器未提供可核实的 `merged_at` / 当前 PR head 字段，不将 CLOSED 自动等同 MERGED。
- PR 描述中最近可见的候选 head 为 `3d7f96352b214b386be410ab619b043898fef6c2`。该 SHA 对应 Backend run `42456223737`、PostgreSQL run `42456223768`、Frontend run `42456223776`，三项均 completed / success；各自唯一 job 的所有列出步骤均 success。该 SHA 的 combined status 另有 Vercel failure（Hobby build-rate-limit），不是 GitHub Actions 失败。
- 仓库中存在 merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`，且 compare 确认它是当前 main 的祖先；但 `3d7f963...` 与该 merge commit 的 ancestry compare 为 diverged，不能把上述三项 CI 结果冒充为该 merge commit 或实际合并 head 的结果。merge commit 本身的 PR-triggered Actions 查询为空，combined status 仅见 Vercel success。PR #67 的真实合并标志/实际合并 head仍 **NOT VERIFIED**。
- 当前 main SHA `dc7268c...`、working SHA `06f468c...`、历史候选 SHA `e699906...` 的 commit-workflow 查询均未返回可见 PR-triggered runs；各 SHA combined status 也没有可证明完整 Actions 的结果。该查询封装只列 PR-triggered runs，故这些 SHA 的全部 push/dispatch Actions 状态均标记 **NOT VERIFIED**，不推断为没有运行或通过。

### 数据库/API 契约复核（只读源码）
- 当前 main 的 canonical migration order 列出 34 个 SQL 文件，最后为 `0041_perpetual_contract_v1.sql`；main 不存在 `0042_financial_operation_type_allowlist_reconciliation_v1.sql`。
- `0039_withdrawal_approve_no_burn_v1.sql` 允许 `withdraw_paid`、`seconds_open`、`seconds_settle`；`0041` 随后重建同一 CHECK constraint，却遗漏这三种既有 operation type。结果是 canonical fresh bootstrap 完成后，后续手动提现完成及 Seconds 开仓/结算写入会被 operation_type CHECK 拒绝。历史候选 11-16 含 `0042`（blob `bee8d82c5525a68ee67c5f05a053c623e0eea199`）恢复完整 allow-list，并新增 `financial-operation-types-contract.test.js`（blob `b6c88a94da403dbdd384d207dcee07e557e8cb66`）断言最终 CHECK 是先前 canonical operation types 的并集；但它尚未进入 main，且候选分支落后 57 个提交。建议在阶段 2 的 main-derived working 基础上纳入迁移、bootstrap allowlist、Docker init allowlist 和回归测试；不得将 0042 当作现有 hosted schema 的增量升级脚本。
- Earn 当前实现入口：`backend/api-core.js`（blob `b713d696c9e0cb0c898fa4b549a8d054c23a838b`，约 2627–2700 行）；数据库合同为 `0006_financial_earn_policy_v5.sql`（blob `9da5f917fb90ddb9b5b040cc1a6544cddf096228`），读取合同为 `0011_financial_read_api_earn_v1.sql`（blob `cbcba43f763f4dae22eff176ceb90bc0126c903d`）。
- API 的 GET catalog 要求登录，从 `earn_product_catalog` 读取并校验 active 产品，数据库不可用/数据无效时返回 503。POST 要求服务端识别的 user、拒绝冻结账户、检查 `financialWritesEnabled()`、共享 rate limit 和 request ID，RPC 的 `p_user_id` 使用 `user.uid`；未通过财务开关时 503 且不回退 JSON 钱包。SQL 的 `subscribe_earn_atomic` 由 0006 从 active catalog 再验证资产、精度并快照产品规则；0006 删除 0005 的旧五参数（含客户端 payout）赎回函数，改为四参数 `redeem_earn_atomic(p_position_id,p_user_id,p_request_id,p_request_hash)`，与当前 API 请求字段一致，赎回金额由数据库按快照计算。RPC 为 SECURITY INVOKER、空 search_path，EXECUTE 限制给 service_role。以上是源码契约，不代表 hosted 授权/运行已验证。
- API owner 仍有一处配置契约差异：订阅路由硬编码七个 product ID 的 Set，并通过 product ID 后缀推导 asset；而正式规则要求产品、资产、资格、期限及收益参数由持久化配置驱动。建议应用开发 AI 在服务端从 catalog 解析 active product 的 asset，再传入 RPC；SQL 继续在事务内重验 active、asset 与精度。数据库负责人本轮不修改 `backend/api-core.js`。
- 当前 0006 的 demand 产品仍通过显式 subscribe 创建 position，收益在 redeem 时按 elapsed time 计算；本轮搜索没有发现独立的自动资格登记/周期性 Earn accrual worker 或 accrual ledger RPC。它尚不能证明正式规则要求的“符合资格的持币用户默认享有活期收益、无需申购”的完整自动入账链路。此为阶段 2 的核心数据库设计缺口，当前阶段不插队实现。
- 已有 `backend/tests/rpc-source-contract.test.js` 覆盖 Earn RPC 签名/请求 hash 等源码合同，`shared-rate-limit.test.js` 覆盖 Earn rate-limit scope；这些是测试存在性证据，本轮未执行测试。

### 阶段与验证状态
- 当前仍为阶段 0：实现入口、负责人、API/SQL 边界及主要基线问题已明确；本轮未取得可执行工作区，未运行 `npm test --prefix backend`、`npm run build --prefix backend` 或隔离 PostgreSQL bootstrap。阶段 0 退出条件尚未全部满足，整体 **进行中**。
- 本轮没有修改应用代码、SQL、测试或 hosted Supabase；没有执行 DDL/DML、Auth 设置、财务操作、Vercel 修改、合并或部署。Hosted 数据库本轮未访问，实时状态 **NOT VERIFIED**。
- 下一项唯一优先任务：取得可执行的 `working` 工作区或针对精确 `working` SHA 的可读取 CI 运行证据，执行后端测试、构建及隔离 PostgreSQL bootstrap，完成阶段 0 基线。阶段 1 认证弹窗由应用开发 AI 负责；阶段 2 的 0042 与 Earn 自动活期入账设计必须等阶段 1 完成后再按规划推进。

本节仅为阶段 0 源码/refs/CI 元数据记录；未进行生产或 hosted 写操作。


## 2026-11-17 状态记录提交回执
- 本轮阶段 0 基线与集成分支复核记录的首次提交 SHA：`fdf4d529a3d1969bab1584297858f7c744c80573`（仅更新 `docs/AI_PROJECT_STATE.md`；未修改应用/SQL/测试）。
- 首次记录提交后的 working HEAD 已再次核实；后续仅补充此回执，不改变前述测试与发布状态。


## 2026-11-17 应用端 Trade Hub / 路由测试只读交接（数据库负责人发现，应用开发 AI 负责）

- 当前 main 的 `frontend/src/features/pages/TradeHubPage.tsx` blob `016b018db75c87ea73703bf9d82190c4dbfb391c`，第 87 行使用 `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`；第 94–154 行四张卡片实际为 Spot、Perpetual、Seconds、Earn。按 Tailwind 默认 `sm=640px`，375px 不会启用两列，实际为单列。
- 当前 main 的 `frontend/e2e/four-products.spec.ts` blob `1ff9fad9cab2951617f96ffd442c1bf55570c298`，第 4 行要求 Spot / Seconds / Contract / Earn 且禁止 Futures；第 22–34 行断言这些名称；第 39–47 行又要求 375px 两列。该测试的业务分类与所有者已明确的四入口要求不一致，且与 TradeHub 当前真实标题（Spot / Perpetual / Seconds / Earn）不一致。按所有者已明确的产品边界，应由应用负责人调整为 Spot、Contract（说明当前接入秒合约）、Earn、Futures（无期货引擎时显示不可用）；不能把 Seconds 和 Perpetual 拆成两个独立入口，也不能把 Perpetual/Seconds 冒充 Futures。
- 当前 main 的 `frontend/e2e/responsive-visual-qa.spec.ts` blob `99336537cb69069f75cf60f6f9fe31d0b769af75` 已覆盖固定宽度 375/390/430/768/1366/1440/1920 及多个中间宽度，并包含 `/trade-hub`；但通用路由/溢出断言不等于四卡片 2×2 几何验收。专项测试虽然尝试断言 375px 两列，但需与正确业务卡片语义一起更新。
- 当前 main 的 `frontend/e2e/auth-routes.spec.ts` blob `52bd91700e93f96e163a7a0d9c6c29e68d7b6096` 第 35–46 行仍断言旧式独立登录页、Username/Password、无 Email 登录、Google disabled；第 119–130 行注册页断言与旧式全屏流程相关。它与最新协作规则/阶段 1 的预览页弹窗、Email/Password + Google 流程存在契约冲突。应用开发 AI 应按阶段 1 的真实产品流程修订测试，不能由数据库负责人修改前端测试。
- 本轮仅静态读取源码与测试文件；未运行 Playwright、未声称 375px 实测失败、未修改任何前端文件。以上均为明确的源码/断言冲突，运行结果仍 **NOT VERIFIED**。


## 2026-11-22 真實資產與模擬餘額隔離修復

### 階段與範圍
- 依本輪倉庫執行規則，未改 main；在共同開發分支 working 實施。
- 本次是針對用戶回報「新註冊用戶資產顯示 10,000 USDT」的最小範圍修復；不更改交易模擬錢包行為、不修改真實金融帳本、不執行部署。
- 階段位置仍依既定規劃記錄為階段 1 開發中；本次單一缺陷修復不代表階段 1 或整體驗收完成。

### 根因與修復
- 根因：frontend/src/features/assets/AssetsPage.tsx 透過 useTrading() 讀取 localStorage 紙面交易餘額，再將其合併到 getAccount() 後端帳戶餘額。紙面交易初始化包含 10,000 USDT，因此模擬金額會被錯誤呈現在真實資產頁。
- 修復：資產頁移除 useTrading / paperBalances 依賴，資產列表只從 account?.balances 後端帳戶快照生成；原本 BTC/ETH/USDT 置頂與其他資產排序保留。
- 模擬錢包 frontend/src/lib/trading.tsx 未修改，其他紙面交易流程保持原狀。
- 新增回歸測試至 backend/tests/manual-credit-assets.test.js，斷言真實資產頁以後端帳戶餘額為唯一來源，且不引用模擬錢包或 demo 初始化餘額。

### 變更與提交
- 分支：working
- 資產頁修復 commit：6856a6eb960a85ca375968bd5d7acf616241678e
- 回歸測試 commit：96658ba70502476d2853247613ea86875dbd6cd9
- 修改文件：frontend/src/features/assets/AssetsPage.tsx、backend/tests/manual-credit-assets.test.js。
- 兩個檔案已從遠端 working 重新讀取確認；資產頁已不含 paperBalances / useTrading，測試檔已包含隔離回歸斷言。

### 測試與驗收
- 遠端源碼複核：PASS（已重新讀取修復後資產頁及測試檔，確認變更存在）。
- node --test tests/manual-credit-assets.test.js：NOT VERIFIED（目前執行環境無法連線 GitHub 取得工作樹；本次未能在本地執行 Node 測試）。
- 前端 npm run lint / npm run build：NOT VERIFIED。
- GitHub commit workflow runs 查詢未返回可見 workflow run；不能推斷測試通過。
- 實際註冊新測試用戶並在手機/桌面端登入查看：NOT VERIFIED。
- 未合併 main、未部署 Vercel、未更改 Supabase 資料。

### Supabase 真實帳本只讀核對
- financial_accounts 有 3 筆 USDT 帳戶記錄，合計 available 610,000 USDT、frozen 0。
- financial_ledger 有 4 筆 USDT 流水、4 個 operation；每個帳戶最新流水的 available/frozen 均與帳戶當前餘額一致，無缺失流水、無最新餘額對帳差異。
- 4 筆流水均連到 financial_operations.operation_type=deposit_credit、狀態 applied，並連到 deposit_records.source=admin_manual、狀態 confirmed。
- 因此這些不是前端 10,000 模擬餘額，而是已確認的管理員手動入帳記錄。只讀核查沒有證明這些入帳是否經所有者逐筆授權；不清除、不回滾、不修改。若要判斷是否應保留，需由所有者核對管理員入帳的業務意圖。
- 本次 Supabase 僅執行 SELECT；沒有 DML、DDL、Auth 或 Storage 寫入。

### 下一項唯一優先任務
- 在可執行的 working 工作區跑回歸測試、前端 lint/build，再以隔離測試帳戶驗證「後端餘額為 0 時資產頁不顯示 10,000 USDT」；通過後再由所有者決定是否合併與部署。


## 2026-11-22 集成分支 / Perpetual API 幂等性只读复核（数据库负责人交接）

### 规则、阶段与分支边界
- 首先尝试读取 `chore/shared-ai-coordination` 的 `docs/AI_COORDINATION.md`，GitHub 返回 404（ref 不存在）；main 上该路径也不存在。当前可读取的正式规则来自 `working/docs/AI_COORDINATION.md`，blob SHA `190ab6ecf712dde2df62109692514e6cab1e431f`。
- 当前规则：`main` 是唯一正式基准，`working` 是唯一共同开发分支；未经所有者批准不得继续创建/使用长期集成分支。当前阶段仍是阶段 1（认证弹窗 / 当前资产显示缺陷回归）开发中，尚未验收。Perpetual 复核作为用户本轮明确要求的只读跨团队风险核查记录，不改变阶段顺序，也不由数据库负责人修改 API 文件。
- 当前 refs：main `8eef5f34ed7bf8e7790ae57516ce5f1810b7b24b`；working `564827924ffd49fd1ddadf7b9322bbb962a890cd`；integration 20261118 `9481a3815a7ce9b9601e56474123eee62c2e69b2`。compare：integration 相对 main diverged，ahead 17 / behind 102；working 相对 main diverged，ahead 24 / behind 166。未 rebase、merge、reset 或强推。
- 用户指定的 `integration/btcbox-mainline-consolidation-20261108` 已不存在；当前仅见 integration 20261116 和 20261118。因正式规则只授权 working 为共同开发分支，本轮没有向 integration 分支提交代码或文档；本次只将交接记录写入正式 working 状态文件。

### PR #67 当前事实
- GitHub API 当前状态：PR #67 closed、merged=true、draft=false；head `c53fa948a599b560c1319726adfb57be6828b0fa`；merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`；merged_at `2026-11-08T16:24:57Z`。
- 因 PR 已合并，无法再将其保持/改回 Draft；没有尝试回退或改写历史。
- PR head 的历史 Backend / PostgreSQL Schema / Frontend CI 分别为 `42498936887`、`42498936856`、`42498936859`，均 PASS；merge commit 的对应 push runs 分别为 `42499773113`、`42499772971`、`42499773083`，均 PASS。这些是 PR #67 历史 SHA 证据，不代表当前 main、integration 或 hosted schema 已满足发布条件。

### 精确 SHA 的 Actions 证据
- 当前 integration HEAD `9481a3815a7ce9b9601e56474123eee62c2e69b2`：Actions runs API 对该 exact SHA 返回 1 项：Watchdog `44860836262` PASS；Check Runs 共 2 项：Watchdog test PASS、Supabase Preview SKIPPED；combined status 为 pending 且 statuses=[]。Backend CI、PostgreSQL Schema CI、Frontend CI 均没有该 exact SHA 的 run/check 记录，故标记 NOT RUN / NOT VERIFIED，不推断为通过。
- 0044 最终迁移清单测试提交 `71c30df52ec90b554c46b5de82ceec662f9d4d1a`：Watchdog `44860701307` PASS；Backend CI `44860701345` FAIL；Supabase Preview SKIPPED；无该 exact SHA 的 PostgreSQL Schema CI。Backend job 的 build 成功，`Run backend tests` 失败，后续 integration tests 与 fail-closed preflight 被跳过；失败测试名称/日志本轮未能通过 GitHub API 取得，根因 NOT VERIFIED。
- 0044 SQL + 数据库场景的最近可核实 Schema CI 是 SHA `2a61bba5c529c3f114de8968553121a4e4fdc110` 的 run `44860697621`，job `empty-postgres-bootstrap` 全步骤 PASS，实际执行 `bash backend/scripts/test-postgres-schema-bootstrap.sh` 并应用规范 SQL 到 disposable PostgreSQL。该结果验证当时的 0044 migration 与集成 SQL；不能替代后续 `71c30df` 的 Backend CI，也不能证明 hosted Supabase 已安装迁移。
- 当前 integration HEAD 的 Watchdog 通过仅证明该文档提交的 watchdog job 成功，不代表 backend、数据库、前端或 fail-closed 验收通过。

### 新发现：close-position API 与 SQL 幂等合同不一致（API owner 负责）
- Integration API 文件 blob：`b5def277c81888b88f877c94ac349e7d5fe1ae07`，close-position 路由约第 2960–2983 行；当前 main API blob `da0d50e2765770d78e3521d412fa52fc4fad138d`，约第 2990–3016 行；working API blob `f5b209e6637eafbd6e851ea9b0dbfc34fc5f83e2`，约第 2854–2880 行。三处路由行为一致：先按当前 position 查询 `side,quantity`；没有 position 就在调用 RPC 前返回 `NO_POSITION`；否则以当前 position quantity 和派生 side 调用 `perp_submit_order`。
- 该 close-position 路由没有像普通 POST order（`rateCheckShared('spot_order')`）或 DELETE cancel（`rateCheckShared('spot_cancel')`）一样执行显式 shared rate limit。API contract test blob `d34e21290a209c2bb4721da67988f8b7de0b8787` 第 65–72 行只断言 NO_POSITION、reduce-only、market 和方向派生，没有限流或重试测试。
- SQL `0044_perpetual_order_idempotency_flags_v1.sql` blob `5b7c4d4b747ed5c3caae543f74d3479c67efbece`：第 44–51 行在 duplicate replay 时比较 `v_existing.quantity <> p_quantity`；第 72–75 行随后才将 close-position 的 `p_quantity` 改成数据库当前 position quantity。因而在首次 close 已部分成交后，用同一 client_order_id 重试，API 会读取缩小后的 position quantity，SQL replay 会将其与原订单 quantity 比较并抛出 `client order id payload mismatch`；若首次 close 已全部完成，API 会先因 position 不存在而返回 `NO_POSITION`，根本到不了 SQL duplicate replay。该路径不能满足“结果不确定时用相同幂等键安全重试”的合同。
- DB integration test blob `0a4e8ee56fcbe0c179f6ed8122dacbd5be03aab6` 第 132–147 行验证的是重用已有普通订单 ID、改变 `reduce_only/close_position` 必须拒绝；没有覆盖同一个 close-position 意图在部分/全部成交后重试的场景。
- 建议 API owner：close-position 在读取当前仓位前先解析 `user.uid + client_order_id` 的既有订单并返回稳定 replay；或设计专用幂等 close RPC，使数据库在同一事务内锁定 position 并处理首次请求/重放。不得依赖重试时重新读取的 position quantity/side 作为原请求 payload。
- 建议数据库 owner 与 API owner共同确定 close-position 的 canonical idempotency payload：稳定字段至少包含已认证 user、symbol、close-position intent；derived quantity/side 不应在 replay 时被当作客户端变化的意图字段。保持 reduce-only 防反向开仓不变。补充实际 PostgreSQL 场景：首次 close、部分成交后相同 key replay、完全成交后相同 key replay、同 key 换 symbol/intent 拒绝、并发相同 key 只创建一个 order。
- 建议 API owner 在 close-position 路由加独立 shared rate-limit scope，并对 limiter unavailable fail closed；补充限流与 limiter outage 测试。
- 以上为源码静态分析，未执行真实交易或 hosted financial RPC；没有修改 `backend/api-core.js`、SQL 或测试。问题归属 API/Backend + DB 合同联合确认。

### 发布准备与当前阶段
- `PRE-RELEASE-CHECKLIST.md` 当前仍为未勾选清单；没有本轮 staging 认证、真实 OAuth、hosted schema parity、财务账本端到端、独立视觉验收或生产回滚证据。PR #67 历史 CI PASS 不等于当前发布就绪。
- 阶段 1 仍未通过；本轮没有把 Perpetual 风险插入当前阶段实施，也没有改变 Earn/Perpetual 的阶段顺序。
- 本轮没有执行 hosted Supabase 写入/读取、Vercel 修改、部署、合并、真实财务操作或交易页布局修改。
- 下一项唯一优先任务仍按最新状态记录执行：在可执行的 working 工作区运行当前资产隔离回归测试、前端 lint/build，再用隔离测试账号验证后端余额为 0 时资产页不再显示模拟 10,000 USDT；随后继续阶段 1 验收。Perpetual close-position 幂等/限流缺口交给 API owner 与 DB owner在相应阶段处理。


## 2026-11-23 自动化续接核查（数据库/集成负责人）

### 规则、阶段与分支边界
- 首先读取 `chore/shared-ai-coordination/docs/AI_COORDINATION.md`：GitHub 返回 404，且分支搜索未发现 `chore/shared-ai-coordination`。
- 当前 `main` 的 `docs/AI_COORDINATION.md` 已被 commit `8eef5f34ed7bf8e7790ae57516ce5f1810b7b24b` 删除（commit message: `docs: remove obsolete AI coordination instructions`）。仍可读取的旧版规则只在 `working/docs/AI_COORDINATION.md`，blob `190ab6ecf712dde2df62109692514e6cab1e431f`；该文件规定 `working` 是唯一共同开发分支、禁止未经所有者批准新增长期分支。
- 最新可读执行规划仍将当前阶段定为阶段 1（认证弹窗），阶段 1 未验收。main 的 `docs/AI_PROJECT_STATE.md` 仍要求等待 Vercel READY 后由所有者测试 /admin Google 登录及合成 KYC 图片。
- refs：main `8eef5f34ed7bf8e7790ae57516ce5f1810b7b24b`；working（本记录提交前）`d6dc8fd142a1ac3e2af037d8fbb649b3bcaf2d9a`；integration 20261118 `9481a3815a7ce9b9601e56474123eee62c2e69b2`。compare：working 相对 main diverged，ahead 25 / behind 166；integration 20261118 diverged，ahead 17 / behind 102。
- `integration/btcbox-mainline-consolidation-20261108` 与 `chore/shared-ai-coordination` 均不存在。由于 main 已删除协调文件、working 仍保留旧规则且严重分叉，本轮不向过时 integration 分支写入，也不执行 rebase/merge；仅在规则仍指定的 working 状态文件追加本只读核查记录。此分支策略冲突需所有者明确指定权威协调 ref 和后续开发分支。

### PR #67 当前事实
- PR #67 API 状态：closed、merged=true、draft=false；head `c53fa948a599b560c1319726adfb57be6828b0fa`；merge commit `fbf301f88c5c19db94ea1546c590667a8818e842`；merged_at `2026-11-08T16:24:57Z`。
- PR review submissions = 0，review threads = 0。PR 描述及历史评论中“Draft/unmerged”文字已过期；以当前 GitHub PR API 的 merged=true 为准，不能再将其改回 Draft，也未尝试回退。
- PR head 的 Backend / PostgreSQL Schema / Frontend runs：`42498936887`、`42498936856`、`42498936859`，全部 completed/success；merge commit 对应 runs：`42499773113`、`42499772971`、`42499773083`，全部 completed/success。仅为历史 SHA 证据。

### 精确 SHA 的 GitHub Actions
- main `8eef5f34ed7bf8e7790ae57516ce5f1810b7b24b`：Actions API 返回 8 个 runs（4 个 Watchdog push、4 个 Sync mirror schedule），全部 completed/success；9 个 check runs 中 4 个 Watchdog test success、4 个 mirror success、1 个 Supabase Preview skipped。Combined status 另有 Vercel failure（非 GitHub Actions）；该 SHA 没有 Backend CI、PostgreSQL Schema CI 或 Frontend CI。
- working `d6dc8fd142a1ac3e2af037d8fbb649b3bcaf2d9a`：Backend CI run `44980634404` conclusion=failure；GitHub jobs API 对该 run 返回 0 jobs，无法取得失败步骤/日志，根因 NOT VERIFIED。Watchdog run `44980635495` success；check runs 为 Supabase Preview skipped、Watchdog test success。尝试重跑失败工作流被 GitHub 403 拒绝（“This workflow run cannot be retried”）。
- integration 20261118 `9481a3815a7ce9b9601e56474123eee62c2e69b2`：仅 Watchdog run `44860836262` success；Supabase Preview skipped；无该 SHA 的 Backend / PostgreSQL Schema / Frontend CI。
- 本轮未执行本地测试：容器无法解析 github.com，浅克隆失败；不得将源码静态核对描述为测试通过。

### 阶段 1 发现：资产隔离修复只存在于 working，main 仍合并模拟余额
- main `frontend/src/features/assets/AssetsPage.tsx` blob `b63b01c819ccb3e8a0c704359bc986f156fb5501`：第 10 行导入 `useTrading`，第 46 行读取 `paperBalances`，第 104–118 行把 paper balances 合并进 `account?.balances`。该逻辑会让纸面交易初始化余额继续出现在真实资产列表。
- working 修复版本 blob `6734b59cdaf2b0d2595cebd5dd5a2036c5e3b879`：第 99–101 行只从已认证后端 account snapshot 生成余额，不再引用 `useTrading/paperBalances`。
- working 回归测试 blob `304505c8244c5acd59303d9d111a24a9850f6de8` 第 50 行新增 “real asset balances never include paper-trading demo funds”；main 测试 blob `c6318e3c98171869f018b3c53b50ca7126a2925f` 只有前三项测试，没有该隔离断言。现有测试是源码静态断言，不是隔离账号的真实 UI/API 端到端验证。
- 该修复尚未进入 main；由于 working 与 main diverged 25/166，本轮不直接 cherry-pick/merge。应用开发负责人需在所有者确认的 main-derived 开发基线上保留这项最小修复并运行测试。

### 阶段 1 发现：认证合同与 E2E 断言不一致
- main `frontend/src/features/auth/AuthPages.tsx` blob `7e22adf2508e14316d16aa54dc4e5a699802185e` 第 77 行含 email sign-in，第 275 行含 Email 注册按钮。
- main `frontend/src/lib/auth.tsx` blob `dbc0d92cae5619931a77039529413cded143dab8` 第 506–540 行通过 Supabase `signInWithPassword/signUp` 处理 Email 登录和注册，并要求未确认邮箱不得完成 BTCBOX provisioning；这与“保留 Email + Google”规则方向一致。旧 `POST /api/register` 路由在 main `backend/api-core.js` blob `da0d50e2765770d78e3521d412fa52fc4fad138d` 第 1447–1454 行仍返回 `GOOGLE_ONLY_AUTH`，应明确标记为 legacy endpoint，避免误把它当作 Email signup 主流程。
- 但 main `frontend/e2e/auth-routes.spec.ts` blob `83c24673209b1a3ee8710190321953e69c13e252` 第 42–46、62–64、90–91 行仍断言 Email 登录/找回入口不存在；同文件第 138–190 行又验证 Email signup。这些断言与当前 AuthPages 的 Email 登录实现及阶段 1 Email + Google 规则冲突。main 不存在 `frontend/e2e/auth-dialog.spec.ts`，该六路径弹窗验收文件只存在于 working。
- `docs/2026-11-20-PREFLIGHT-CODE-REVIEW.md` 对 Google-only 的描述与当前 main AuthPages/auth.tsx 不完全一致。应用开发负责人需统一真实产品合同、旧 endpoint 说明和 E2E 断言；本轮未修改其文件，也未声称认证已实测。

### Perpetual 静态风险复核（后续阶段/其他负责人）
- main `backend/api-core.js` blob `da0d50e2765770d78e3521d412fa52fc4fad138d` 第 2990–3005 行的 close-position 路由先查询当前仓位、无仓位即返回 `NO_POSITION`，未调用 shared rate limiter；integration API blob `b5def277c81888b88f877c94ac349e7d5fe1ae07` 第 2946–2961 行相同。部分成交后以同一幂等键重试会因数量变化而与原请求不一致；全部成交后则在 SQL replay 前被 `NO_POSITION` 截断。
- integration SQL `0044_perpetual_order_idempotency_flags_v1.sql` blob `5b7c4d4b747ed5c3caae543f74d3479c67efbece` 第 49–60 行先比较已有订单 quantity，第 90 行才按当前仓位重算 close-position quantity；close retry 合同仍未修复。API/DB owner 需设计稳定 close intent 幂等合同，并补部分成交、全部成交、并发重放测试。
- main `perp-funding-worker.js` blob `48da054ba1ad486d344869b6e8d58f7fe57ca814` 第 40–59 行不检查资金费率 POST/PATCH 的 HTTP 成功状态；逐用户结算失败只记录日志，仍可能把 funding rate 标记 settled 并推进 next_funding_at。
- main `perp-liquidation-worker.js` blob `87c509bf4a225684aca71076205acb7b10c767a3` 未见 `FINANCIAL_PERPETUAL_ENGINE_ENABLED` 或 `financialWritesEnabled` 检查。API/Backend owner 需确定保护性强平的独立默认关闭/授权策略；本轮未运行 worker 或金融 RPC。

### 发布准备与阶段状态
- main `PRE-RELEASE-CHECKLIST.md` blob `c4edae56d7b8cee484b12319f8975436dbbaa1db`：24 项未勾选、0 项勾选。仍包含旧 `ADMIN_PASS/ADMIN_USER`、旧 60 项测试口径等过期条目，与当前 Supabase Auth + DB RBAC 结构不一致；需由发布负责人更新清单，不可据此声称发布门槛已满足。
- 当前阶段仍为阶段 1，认证弹窗/Email + Google 真实链路、资产余额隔离的运行时验证、main 与 working 代码一致性均未完成。视觉验收、hosted Auth parity、真实金融执行和生产就绪均 NOT VERIFIED。
- 本轮没有修改应用代码、SQL、测试、Vercel、hosted Supabase、Auth 设置或资金开关；没有合并、部署、真实资金操作或交易页布局变更。

### 下一项唯一优先任务
- 所有者先明确权威协调文档 ref（`chore/shared-ai-coordination` 当前不存在，main 已删除 `docs/AI_COORDINATION.md`）及 working/main 的安全整合策略；确认后由应用开发负责人把资产隔离修复与 Email + Google 弹窗合同纳入 main-derived 工作基线，并运行资产回归、认证 E2E、前端 lint/build。阶段 1 未通过前不推进 Earn/Perpetual 后续阶段。
