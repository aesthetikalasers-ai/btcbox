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
- 必须记录阶段与退出条件、完成事项、修改文件、分支和完整 SHA、测试命令/结果/证据、未完成事项、阻塞、下一步唯一优先任务及规划一致性。
- 未验证事项标记 NOT VERIFIED；没有提交不得编造 SHA；阶段退出条件未满足不得报告通过。
- 该模板对所有参与者一视同仁，并要求重要进度后同步更新本状态文件。

## 2026-11-20 集成分支复核与风险交接（本助手：数据库负责人）

### 协作规则、阶段和分支事实
- 按用户指定读取 `chore/shared-ai-coordination` 上的 `docs/AI_COORDINATION.md`，GitHub 返回 404：该 ref 当前不存在。随后读取 `main` 与 `working` 上的同一路径；两者文件 blob SHA 均为 `190ab6ecf712dde2df62109692514e6cab1e431f`。
- 当前协作规则：`main` 是唯一正式基准，`working` 是唯一共同开发分支；数据库 AI 负责 SQL、RPC、钱包账本及数据库侧授权/幂等，应用开发 AI 负责 API 接入和前端。
- 当前远程 refs：`main` = `23d668158811f4b5e4bcb744d2314cd6d9a57770`；`working` = `adadd07fba032b20e35ebb03f3ff63fd1146ac1b`。GitHub compare `main...working` 为 `diverged`，working ahead 19、behind 64。不得合并、重置或改写该分支。
- `working` 上的 `docs/AI_PROJECT_STATE.md` 顶部记载阶段 1（认证弹窗）开发中、尚未验收；同一文件后段又记载阶段 0 仍在进行。当前 main 版本状态文件仍记载阶段 0。执行计划要求阶段退出条件未满足不得跳阶段。阶段位置存在文档冲突，Earn 阶段及 Perpetual 后续扩展不得据旧集成记录宣告已开始或已完成。
- 用户本轮要求继续使用集成分支；指定的旧分支 `integration/btcbox-mainline-consolidation-20261108` 当前不存在（Git ref 查询 404），PR #67 元数据所记录的原 head 为 `c53fa948a599b560c1319726adfb57be6828b0fa`。本轮使用仓库中唯一仍存在的集成候选 `integration/btcbox-mainline-consolidation-20261118` 做只读复核及本状态记录；其 HEAD 为 `fa43074803659c0a76ca57733248875cdc1f765c`。共享规则仍写明 working 是唯一共同开发分支，集成分支与该规则之间的长期分支策略冲突需由所有者明确收敛；本轮未改动应用/SQL 源码。
- 当前集成候选相对 main：ahead 4、behind 0，merge-base 等于 main HEAD。变更仅涉及 CI 路径、空库 bootstrap 清单、SQL 0042/0043、相关测试和迁移文档。

### PR #67 真实状态
- GitHub PR #67：`closed`、`merged=true`、`draft=false`；merged_at = `2026-11-08T16:24:57Z`。
- 原 head SHA：`c53fa948a599b560c1319726adfb57be6828b0fa`；merge commit：`fbf301f88c5c19db94ea1546c590667a8818e842`。
- 因 PR 已合并，不能再将它改回 Draft；不得通过回退或改写历史来模拟 Draft 状态。后续验收必须针对仍开放的独立候选分支/PR，不得把 PR #67 历史描述中的 Draft 文本当作当前状态。

### 集成候选 exact-head CI（全部对应 fa43074803659c0a76ca57733248875cdc1f765c）
GitHub Actions API 按 `head_sha` 精确过滤，返回总计 3 个 workflow runs：
- Claude Watchdog #44451166709：success。
- PostgreSQL Schema CI #44451166858：success；job `empty-postgres-bootstrap` 的 “Apply all canonical SQL files to disposable PostgreSQL” 步骤 success。
- Backend CI #44451166797：failure；job `Unified frontend/backend build, tests, and fail-closed preflight` 中 Build unified site success，但 Run backend tests failure；后续 backend/frontend integration tests、fail-closed deployment configuration preflight 和 unified output checks 均 skipped。
- Backend job 日志：549 tests，545 pass、4 fail。失败精确位置：
  1. `backend/tests/admin-auth.test.js:31`：实际 Auth user 返回 `email: ''`，测试期望对象省略 email。
  2. `backend/tests/google-only-auth.test.js:17`：测试断言 `signInWithEmail` 不存在，与当前 Email/Password + Google 规则冲突。
  3. `backend/tests/google-only-identity.test.js:67`：测试要求 `GOOGLE_ONLY_AUTH`，与当前 Email/Password + Google 规则冲突。
  4. `backend/tests/spot-trading-live-refresh.test.js:236`：Support 刷新测试仍要求旧组件状态代码片段。
- 对该 SHA 的 combined commit statuses 返回空数组；以上 3 项 Actions 是该 SHA 的全部 workflow runs（API `total_count=3`）。未发现可用于替代失败 Backend CI 的其他 exact-head workflow。
- 精确证据链接：
  - https://github.com/avali9308-code/btcboxcdt/actions/runs/44451166709
  - https://github.com/avali9308-code/btcboxcdt/actions/runs/44451166858
  - https://github.com/avali9308-code/btcboxcdt/actions/runs/44451166797

### SQL / API 幂等与授权复核
- SQL 0043 文件 blob SHA：`8c7e5d60eff1762c697ef7a95955967a6a8ddc15`。其 `perp_settle_funding_one` 使用 advisory transaction lock 串行化同一幂等键、以持久化 funding rate 为准、拒绝传入费率不匹配，并在一次事务中更新余额/保证金、ledger、funding_paid 与 history。
- 该函数撤销 PUBLIC/anon/authenticated EXECUTE，仅授予 service_role；SECURITY INVOKER、空 search_path。集成候选的 disposable PostgreSQL Schema CI 对全部 canonical SQL 成功，但这不等于 hosted Supabase 已应用 0042/0043，也不等于 hosted RPC 已验证。
- `backend/tests/perpetual-api-contract.test.js` blob SHA：`d34e21290a209c2bb4721da67988f8b7de0b8787`。其 API feature-switch 测试检查 API 写入口默认关闭及 financial write gating；worker 测试仅检查 worker 文件存在、服务密钥/RPC 字符串和少量标记，不覆盖 worker HTTP 非 2xx、部分结算失败、进度推进或 worker 默认关闭行为。

### 新增高优先级 Backend worker 风险（证据为源码静态检查，未执行 worker）
**责任归属：应用/API Backend owner；数据库 AI 不修改 worker 文件。**

1. `backend/scripts/perp-funding-worker.js` blob SHA `48da054ba1ad486d344869b6e8d58f7fe57ca814`：
   - 第 20–22 行：`restGet` 对任何非 2xx 返回空数组，调用方无法区分“确实无记录”和“读取失败”。
   - 第 40–42 行：funding rate POST 没有检查 `response.ok`；只捕获网络异常。
   - 第 44–50 行：单个 position settlement 失败只记录日志，循环继续。
   - 第 52–59 行：无论部分用户结算是否失败，仍尝试将 rate 标记 settled 并推进 `next_funding_at`；PATCH 也未检查 HTTP 状态。
   - 第 61–62 行：即使出现逐用户结算失败，进程仍可输出 pass complete 并 exit 0。
   - 建议：区分读取错误与空结果；要求 rate insert 成功或确认是同一权威 rate 的幂等重复；累计并传播结算失败；只有所有目标 position 成功/幂等完成后才标记 settled 和推进 interval；每个 PATCH 校验响应；失败时非零退出且保持可重试。增加 mocked-fetch worker 测试覆盖非 2xx、rate insert 失败、部分用户失败、重复请求、PATCH 失败及重启重试。
2. `backend/scripts/perp-liquidation-worker.js` blob SHA `87c509bf4a225684aca71076205acb7b10c767a3`：
   - 第 19–21 行：positions 读取非 2xx 被转换为空数组。
   - 第 25–30 行：仅验证 URL/service key 存在，随后直接读取所有未平仓 position 并调用 `perp_liquidate_position`；worker 本身没有显式检查 `FINANCIAL_PERPETUAL_ENGINE_ENABLED` 或完整 financial-write gate。
   - 建议：由所有者/Backend owner 明确“订单引擎关闭时，已有仓位的风险保护性强平是否仍应运行”。若允许，应定义单独、明确、审计的 liquidation safety policy/gate；若不允许，应由默认关闭的 worker gate 阻止执行。无论策略为何，读取失败必须与空结果区分。
3. 当前 `perpetual-api-contract.test.js` 的 worker 测试没有覆盖上述行为；API 路由 feature gate 不会自动保护绕过 API、直接使用 service-role 的定时 worker。

以上为代码风险，不证明这些脚本当前已被 scheduler 启用或实际执行；worker runtime、cron/scheduler 配置和 hosted flags 均 NOT VERIFIED。

### 发布就绪与未验证边界
- 集成候选状态：NOT READY（Backend CI failure；worker fail-closed/retry gaps；阶段/分支规则冲突）。
- PR #67 已合并，不能作为仍待 Draft 验收的候选。
- 0042/0043 只在 disposable PostgreSQL CI 中验证；hosted Supabase schema/RPC parity、真实 Email/Google staging、runtime flags、worker scheduler 状态、live financial execution 均 NOT VERIFIED。
- 前端 responsive/route/visual acceptance 本轮未执行；不得以历史 CI 或截图替代当前 exact-head 验收，也不得宣称视觉验收通过。
- 本轮未修改 hosted Supabase、Auth、Vercel、环境变量或真实资金；未部署；未合并；未改动锁定的交易页布局。

### 下一步唯一优先任务
由 API/Backend owner 先修复并增加 `perp-funding-worker.js` 的失败关闭/可重试测试，明确 liquidation worker 在引擎关闭时的安全策略；在该修复前，不得将 Perpetual 后台资金工作进程标记为可发布。数据库 AI 不越权修改 worker 文件，后续仅复核 SQL/RPC 与其确定后的接口合同。
