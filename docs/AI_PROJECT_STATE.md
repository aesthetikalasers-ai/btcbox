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

- 已新增 `docs/AI_STATUS_REPORT_TEMPLATE.md`，作为AI 1、AI 2 和开发人员的强制进度汇报模板。
- 适用时机：开始任务、完成任务、阻塞、阶段验收及跨成员/跨会话交接。
- 必须记录阶段与退出条件、完成事项、修改文件、分支和完整 SHA、测试命令/结果/证据、未完成事项、阻塞、下一项唯一优先任务及规划一致性。
- 未验证事项标记 NOT VERIFIED；没有提交不得编造 SHA；阶段退出条件未满足不得报告通过。
- 该模板对所有参与者一视同仁，并要求重要进度后同步更新本状态文件。


## 2026-11-16 — 钱包产品定位与双 AI 职责更新

- 所有者最新决定（2026-11-16）：建设阶段 Wallet 与 Exchange 暂时共用同一 Supabase 项目/服务器数据库和 Auth，不急于拆库。产品域、业务资料、资产账户、余额、账本、地址、交易记录和权限仍分别隔离；同库不等于共用资金账本。系统搭建稳定后再规划物理拆分。测试账号和测试数据无需保留，不执行恢复。
- 两个系统通过明确授权、可审计、幂等 API 进行必要联通；例如用户主动发起的钱包与交易所间转账。
- 第三方 API 可作为底层区块链节点、链上数据、交易广播等基础设施；BTCBOX 保留钱包产品、业务 API、账户和账本控制权。密钥管理与签名必须安全隔离。
- 双 AI 分工固定：AI 1（本助手）负责钱包架构、后端 API、数据库、业务逻辑、安全、测试、前后端整合及规划/状态维护；AI 2 负责视觉蓝图、页面、交互、手机/桌面适配及 UI 验收。**不再设置 AI 3 或第三位协调负责人。**
- UI 可先使用明确标记的 Mock 数据并通过 API 适配层并行开发；不得把 Mock 冒充真实业务。
- 已更新 `docs/AI_COORDINATION.md` 与 `docs/AI_EXECUTION_PLAN_2026-11-16.md`。本次仅更新项目文档，没有修改应用代码、数据库、生产配置，也没有部署。
- 当前功能实现状态：钱包 UI 与新增真实钱包 API 尚未因本次文档更新而完成；逐项状态仍为 NOT VERIFIED，须以代码和测试证据为准。


## 2026-11-16 — AI 1 钱包只读 API 第一批交付

- 当前开发分支：`feat/wallet-api-contract-v1`；本批代码基线提交：`8b33b43de7d4ade86fb998b98a540b04d48787d2`（随后仅更新本状态/合同文档）。
- 新增 `backend/wallet-api.js`，并在 `backend/api-core.js` 中仅对 `/api/wallet/*` 按需加载，避免影响既有认证隔离测试。
- 已实现：`GET /api/wallet`、`GET /api/wallet/addresses`、`GET /api/wallet/ledger`；均从登录会话中的服务端 Supabase 身份确定 owner，不接受客户端 user_id 授权。
- 已实现保护：服务端 service-role 访问、owner 过滤、只读字段白名单、账本金额/BigInt ID 无损解析、十进制精确合计、分页游标校验、错误信息脱敏。
- 地址生成 `POST /api/wallet/addresses` 在未配置托管/派生服务时 fail-closed；外部钱包验证与密钥同意/托管 API 尚未实现，不得对外宣称已完成。
- 新增 `backend/tests/wallet-api.test.js`，覆盖身份隔离、地址过滤、负数账本变动、金额精度、服务故障和地址服务未配置等场景。
- 恢复了本分支损坏的 `.github/workflows/backend-ci.yml`（此前文件内容误为 React 登录页源码），采用仓库历史有效 CI 配置并纳入本分支。
- GitHub Actions 后端 CI：构建、后端测试、本地集成、部署配置预检及产物检查均通过；验证提交：`8b33b43de7d4ade86fb998b98a540b04d48787d2`。见 [CI run](https://github.com/avali9308-code/btcboxcdt/actions/runs/43846023277)。
- Supabase 仅执行只读结构、迁移、权限和行数核对；未执行 DDL、数据写入或生产资金操作。钱包相关表当前均为 0 行；无已配置地址派生/托管服务，实时 API E2E 仍为 NOT VERIFIED。
- 本批未修改交易页、未合并 `main`/`working`、未部署。功能分支与共同开发分支仍需单独评估差异后才能整合。

**下一项优先任务：** 在当前共用 Supabase 项目/数据库继续完成钱包真实业务能力，不另建服务器或数据库。测试账号/测试数据无需保留，不做数据恢复；钱包迁移 SQL 源文件整理可后置，不作为开发阻塞项。


### Supabase 钱包基础设施核对补充（只读）

- 当前 Supabase 项目已应用钱包基础迁移；`auth.users` 上存在 `btcbox_auth_user_initialize_v1` 触发器，调用 `btcbox_initialize_auth_user_v1()`。该 SECURITY DEFINER 函数在安全固定的 search_path 下创建 `btcbox_user_profiles`，并为全部 active `btcbox_assets` 创建 `btcbox_wallet_accounts`。
- 当前 active 钱包资产为 ADA、AVAX、BNB、BTC、DOGE、ETH、SOL、USDT、XRP，共 9 种。当前 `auth.users`、钱包 profile 和 wallet account 均为 0 行；这是测试账号清理后的空库状态，不需要手工插入用户或余额。新 Auth 用户创建时应由触发器自动初始化账户。
- 工程记录：当前 Supabase 已应用的钱包基础迁移 SQL 尚未完整纳入仓库空库 bootstrap 清单。这是未来需要整理的可复现性事项，不要求恢复测试账号/测试数据，也不阻塞在现有数据库继续开发。

已核对的相关 Supabase migration history（需逐项恢复源 SQL，不能凭名称猜写）：
- `20261116053214 btcbox_canonical_user_wallet_foundation_v1`
- `20261116053252 btcbox_auth_trigger_security_and_retention_v1`
- `20261116053322 btcbox_atomic_wallet_operation_rpc_v1`
- `20261116053410 btcbox_wallet_asset_account_seeding_v1`
- `20261116053437 btcbox_wallet_foreign_key_indexes_v1`
- `20261116061921 restrict_wallet_trigger_function_execution_v1`
- `20261116062333 btcbox_hybrid_wallet_secure_key_vault_foundation_v1`
- `20261116062346 btcbox_hybrid_wallet_security_triggers_v1`
- `20261116062407 btcbox_hybrid_wallet_key_foreign_key_indexes_v1`
- `20261116062444 btcbox_platform_owner_security_approval_foundation_v1`
- `20261116062452 btcbox_owner_security_foreign_key_indexes_v1`
- `20261116062527 btcbox_existing_business_foreign_key_indexes_v1`
- `20261116062655 btcbox_consent_gated_encrypted_key_write_rpcs_v1`
- `20261116062729 btcbox_external_wallet_verification_rpcs_v1`
- `20261116062800 btcbox_wallet_ledger_owner_asset_integrity_v1`
- `20261116062822 btcbox_wallet_ledger_composite_fk_indexes_v1`
- `20261116064230 btcbox_auth_user_bootstrap_rpc_v1`

- 钱包表已启用 RLS，当前没有面向 anon/authenticated 的直接表访问策略；后端只通过服务端 service-role 只读查询并附带会话 owner 过滤。Supabase Advisor 对“RLS enabled, no policy”给出 INFO 项；此设计是 fail-closed，不应为了消除提示而开放客户端表权限。
