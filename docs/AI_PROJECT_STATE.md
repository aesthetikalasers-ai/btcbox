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
- 用户本轮要求继续使用集成分支；指定的旧分支 `integration/btcbox-mainline-consolidation-20261108` 当前不存在（Git ref 查询 404），PR #67 元数据所记录的原 head 为 `c53fa948a599b560c1319726adfb57be6828b0fa`。仓库分支检索实际返回两条同前缀集成分支：`integration/btcbox-mainline-consolidation-20261116` 与 `integration/btcbox-mainline-consolidation-20261118`。前者 HEAD `e6999067fe6e7500ce2279d7c0535aeb33e646d8`，相对 main diverged（ahead 11 / behind 77）；其 exact-head Backend CI #43798073583 success、Watchdog #43798073496 success、Frontend CI #43798073456 failure。Frontend job 的 lint、decimal 检查、build 通过，但 desktop/mobile route smoke tests 失败；日志为 134 failed、231 passed、1 flaky、4 skipped，responsive screenshots 上传步骤成功。该分支高度落后且已分叉，本轮未使用。当前代码集成候选 `integration/btcbox-mainline-consolidation-20261118` 的源代码 HEAD 为 `fa43074803659c0a76ca57733248875cdc1f765c`，相对 main ahead 4 / behind 0，故本轮在该分支复核并更新状态文档。共享规则仍写明 working 是唯一共同开发分支，集成分支与该规则之间的长期分支策略冲突需由所有者明确收敛；本轮未改动应用/SQL 源码。
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
当前正式执行规划与状态文件对阶段位置存在冲突（main 版本为阶段 0；working 状态顶部为阶段 1 认证弹窗开发中，后段又记载阶段 0）。在冲突收敛前不得宣告阶段 0/1 退出，也不得提前启动 Earn 阶段。按 working 状态顶部已列明的待验收项，下一项优先任务是由应用开发 AI 在 `working` 完成 `frontend/e2e/auth-dialog.spec.ts` 六条路径的 Playwright 实测并修复失败项；项目负责人/协调负责人同步统一阶段状态与长期分支策略。上述 Perpetual worker 风险作为后续集成发布阻塞记录保留：进入对应阶段后由 API/Backend owner 修复 funding worker 的失败关闭/可重试行为，并明确 liquidation worker 在引擎关闭时的安全策略。数据库 AI 不越权修改 worker 文件。


## 2026-11-21 集成分支续接核查（数据库负责人）

### 协作规则与阶段
- 首先读取用户指定的 `chore/shared-ai-coordination` 上 `docs/AI_COORDINATION.md`，GitHub 返回 404，分支搜索也无该 ref。随后读取 `main` 与 `working` 的同一路径，两者 blob SHA 均为 `190ab6ecf712dde2df62109692514e6cab1e431f`。
- 当前规则仍指定 `main` 为唯一正式基准、`working` 为唯一共同开发分支；数据库 AI 负责 SQL/RPC/账本/数据库侧授权与幂等，应用开发 AI 负责 API、worker 和前端。按所有者本轮明确要求，本次只在已经存在的集成分支补充交接记录，没有创建新分支。
- 阶段位置仍有冲突：`main` 的项目状态文件记录阶段 0；`working` 顶部记录阶段 1 认证弹窗开发中，但后段仍有阶段 0 记录。执行计划要求阶段按退出条件推进。阶段 0/1 均未被本轮宣告通过；Earn 阶段不得提前启动。

### 远程 refs 与 PR
- `main` HEAD：`c5a08fca80d43b12dd40544f86e9ec8949922609`。
- `working` HEAD：`adadd07fba032b20e35ebb03f3ff63fd1146ac1b`（与本轮 compare 核对结果一致）。
- 本集成分支 `integration/btcbox-mainline-consolidation-20261118` HEAD：`8fddcdc101b668cd2a1e07d155e2ccc32bc93592`；以该 SHA 为 base 与分支 ref compare，结果 identical（ahead 0 / behind 0）。
- `integration/btcbox-mainline-consolidation-20261108` 不存在；分支搜索返回空。
- 当前 `main...integration/20261118` compare 为 diverged：集成分支 ahead 7、behind 66，merge-base 为 `23d668158811f4b5e4bcb744d2314cd6d9a57770`。该集成候选明显落后于 main；本轮未 rebase、merge、reset 或强推。
- PR #67 issue 状态为 closed（closed_at `2026-11-08T16:24:57Z`）；其记录的 merge commit `fbf301f88c5c19db94ea1546c590667a8818e842` 已由 compare 证实是当前 main 的祖先。PR #67 不能再设为 Draft；review submissions 与 review threads 当前查询均为空。不要把 PR 描述中的历史 Draft 文字当作当前状态。

### 精确 SHA 的 Actions 证据
- 当前集成 HEAD `8fddcdc101b668cd2a1e07d155e2ccc32bc93592`：commit-workflow-runs 查询（该连接器只返回 PR-triggered runs）为 0；combined commit statuses 为 0。不能据此声称所有 push/dispatch workflow 都没有运行。
- Run `44669537115` 的 job checkout 日志明确检出上述 exact SHA；job API summary 显示 job `test` conclusion=success，但同一 job 解码日志中 `npm ci` 报 EUSAGE（仓库根目录没有 package-lock.json/npm-shrinkwrap），并显示进程 exit code 1。该 summary/log 不一致，且这不是 Backend、Frontend 或 PostgreSQL Schema CI；因此将当前 exact-head 应用测试状态记为 **NOT VERIFIED**，不能把该 Watchdog run 当作应用测试通过。
- 最近的代码基线 `fa43074803659c0a76ca57733248875cdc1f765c` 与当前 HEAD 比较为 ahead 3 / behind 0；中间新增内容仅修改 `docs/AI_PROJECT_STATE.md`。该代码 SHA 的历史 Actions：PostgreSQL Schema CI `44451166858` PASS；Backend CI `44451166797` FAIL（549 项中 545 pass、4 fail）；Claude Watchdog `44451166709` PASS。它们不是当前 exact HEAD 的完整 CI 验收。
- Backend 四项已知失败仍为：`admin-auth.test.js:31` 空 email 返回形状；`google-only-auth.test.js:17` 与 Email + Google 决策冲突；`google-only-identity.test.js:67` 仍要求 GOOGLE_ONLY_AUTH；`spot-trading-live-refresh.test.js:236` 依赖旧 Support 组件状态。归应用/API owner，不由数据库 AI 修改。
- 当前集成 HEAD 的 Frontend/route/responsive CI 为 **NOT VERIFIED**；历史集成分支上的截图或旧 CI 不替代当前 exact-head 结果。

### SQL / API 合同、幂等与授权复核
- main 当前 `backend/api-core.js` blob `da0d50e2765770d78e3521d412fa52fc4fad138d`，集成分支对应 blob `b5def277c81888b88f877c94ac349e7d5fe1ae07`。逐段比较 Perpetual API route block，两个版本内容完全一致（13,281 字符）；main 后续 API 改动没有改变该 Perpetual route block。
- main 的 canonical SQL `0041_perpetual_contract_v1.sql` blob `824514a8c076452de0ec882634789df197d22dc9`：`perp_submit_order` 参数签名与 API payload 对齐；SQL 使用 user/client_order_id advisory lock、校验重放 payload；`perp_cancel_order` 以 user/client_cancel_id 加锁并绑定 order_id。两个函数均 SECURITY INVOKER、空 search_path，客户端角色没有 EXECUTE 授权，service_role 有 EXECUTE 授权。
- 集成分支 `0043_perpetual_funding_settlement_idempotency_v1.sql` blob `8c7e5d60eff1762c697ef7a95955967a6a8ddc15` 保持 `perp_settle_funding_one(text,timestamptz,numeric,text)` 原签名；检查持久化 rate 与 p_rate 一致、对相同 funding/user 幂等键取得 advisory transaction lock、同一事务内写 financial_operations / financial_ledger / position funding_paid / funding_history；SECURITY INVOKER、空 search_path，REVOKE PUBLIC/anon/authenticated，仅 GRANT service_role。
- API 从服务端会话的 `user.uid` 传入 p_user_id；订单/撤单要求客户端幂等键；Perpetual write gate 要求 `FINANCIAL_PERPETUAL_ENGINE_ENABLED === '1'` 且完整 `financialWritesEnabled()`，`perpRpc` 再次检查该 gate。源码合同静态一致，但没有证明 hosted Supabase 已应用 0042/0043。
- main 仍以 0041 为 canonical SQL；集成分支独有 0042/0043。main 自 merge-base 以来的 66 个提交中，本轮筛查未发现后续 SQL/perpetual migration 文件变化；但分支整体落后 66 个提交，不能据此视为可直接合并。
- API close-position route 读取当前用户 position 后再提交 reduce-only market order；route block 未见与 order/cancel 相同的显式 shared rate-limit 调用。请 API owner 确认是否有统一上层限流覆盖，若没有，应补 route-level rate-limit 与重复/并发 close 测试。数据库 AI 不修改 API 文件。

### Worker fail-closed / release 风险（应用/API Backend owner）
- `backend/scripts/perp-funding-worker.js` blob `48da054ba1ad486d344869b6e8d58f7fe57ca814` 仍将 REST GET 非 2xx 转为空数组；rate insert/PATCH 不校验 HTTP 状态；单个用户结算异常只记录日志，随后仍可能把 rate 标记 settled、推进 next_funding_at 并 exit 0。worker 当前将 funding rate 固定为 0（注释说明 premium index 尚未接入）。0043 的数据库幂等修复不能弥补 worker 的部分失败编排缺口。
- `backend/scripts/perp-liquidation-worker.js` blob `87c509bf4a225684aca71076205acb7b10c767a3` 同样把 REST GET 非 2xx 转为空数组；worker 本身未显式检查 Perpetual/full financial write gate。若新订单关闭时仍允许保护性强平，必须由 owner 定义单独、可审计的 liquidation safety gate；不能默认绕过总门禁。
- `backend/tests/perpetual-api-contract.test.js` blob `d34e21290a209c2bb4721da67988f8b7de0b8787` 的 worker 覆盖仅检查文件/密钥/RPC 字符串及少量标记，未模拟非 2xx、部分用户失败、rate insert/PATCH 失败、重启重试或 gate 关闭。worker runtime/scheduler 是否启用仍 NOT VERIFIED。
- 上述 worker/API 文件归应用/API Backend owner；本轮只记录证据与建议，未修改其文件、未运行 worker。

### 验收状态与下一步
- SQL 0042/0043 的历史 disposable PostgreSQL CI 证据仍可作为该代码 SHA 的迁移验证；当前 exact HEAD 的 Backend/Frontend/PostgreSQL 全套 CI、阶段 1 六条 auth-dialog Playwright 路径、响应式视觉验收、hosted schema/Auth、worker scheduler/runtime、真实资金执行均 **NOT VERIFIED**。
- 集成候选状态：**NOT READY**（当前 exact-head 应用 CI 不完整；Backend 基线有 4 项失败；worker 部分失败可能误推进周期；集成分支落后 main 66 个提交；阶段 0/1 状态冲突）。
- 本轮仅更新本状态文档；未修改 SQL/API/worker/frontend 源码；未执行 hosted Supabase 写入、Auth/Vercel 设置修改、生产部署、合并、真实资金操作或交易页布局变更。
- 下一项唯一优先任务：由应用开发 AI 在正式共同开发分支完成 `frontend/e2e/auth-dialog.spec.ts` 六条 Playwright 验收并修复失败项，同时由项目 owner 统一阶段 0/1 与分支策略；API/Backend owner 后续按本节证据修复 worker 失败关闭/重试并补模拟 HTTP 失败测试。数据库 AI 不越权修改应用文件。
