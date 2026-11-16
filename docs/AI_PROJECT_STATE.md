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
- `main` HEAD：`910d7f1ea270d995f1c065c9f0a69ddff141310a`
- `working` HEAD：`e05f429a0c209c38ad45f20a17425ef9d4c690f9`
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

