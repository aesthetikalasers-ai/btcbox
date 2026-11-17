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
