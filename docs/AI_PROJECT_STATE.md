# BTCBOX — 项目交接状态

**更新日期：** 2026-11-17  
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


### 2026-11-16 — 钱包空余额币种显示规则

- 按所有者要求：用户没有某币种资产时，不在钱包资产列表中自动显示该币种。
- `GET /api/wallet` 现仅返回 `available + frozen > 0` 的资产账户；初始化时创建的零余额账户不再出现在 API 返回列表，因此 UI 不应显示空余额币种。
- 可用余额或冻结余额任一大于 0 时，该币种仍显示；全部币种余额为 0 时返回空数组，由 UI 显示空钱包状态。
- 已增加测试覆盖：混合零余额/非零余额时只显示有资产币种；全部为零时返回空列表。


## 2026-11-17 — Wallet API 后端继续推进（AI 1）

**当前实际工作分支：** `feat/wallet-api-contract-v1`（既有功能分支；本轮未新建分支）。 与 `working` 最新比较为 **82 commits ahead / 12 commits behind**，共同开发分支 HEAD 为 `1546cc0e9414776e3021017969ebf825c893cdb0`；当前存在明显分歧，禁止盲目合并。本轮 AI 1 最近状态文档提交：`8ac87d91488594377f2f991c2eabe799f9e01756`；最近一笔后端/测试提交：`ac5e9d90d3c261ba3220be019b9f31fb613a459e`。这不是 main/working 的更新；未合并、未部署。

### 已完成源码工作
- 修复钱包账户 `version` 的 PostgreSQL BIGINT 字符串校验；后端 CI run `43903136961` 已通过统一构建、后端测试、本地前后端集成、fail-closed 部署配置预检及产物/入口检查。该 CI 仅验证当时提交，不覆盖本节后来新增的身份映射与转账草稿。
- 新增 `persistSupabaseAuthMapping` 服务端 helper：只使用经过 Supabase `/auth/v1/user` 验证的 UUID 和服务端 BTCBOX `uid`，调用 server-only RPC。现有账户在 2FA 早退前处理；新账户先保存 BTCBOX state 再尝试持久映射。
- 身份映射调用受 `BTCBOX_AUTH_MAPPING_RPC_ENABLED=1` 显式开关控制；默认关闭。未应用 migration 前不得开启，避免登录路径调用不存在的 RPC。
- 新增 `backend/supabase/sql/0042_btcbox_auth_mapping_registration_v1.sql` 草稿：同一事务内创建 Exchange 身份主表记录，并调用现有身份映射/身份元数据 RPC；仅授权 service_role，不写入密码或密钥。
- 新增 `backend/supabase/sql/0043_btcbox_wallet_exchange_transfer_v1.sql` 草稿：定义 Wallet↔Exchange 单 PostgreSQL 事务、固定 Wallet→Exchange 的锁顺序、服务端身份映射、资产/账户状态校验、幂等和双账本写入。新增的转账 RPC 目前没有 API 路由调用，也没有应用到 Supabase；已补充空方向拒绝和按用户幂等键串行化。
- 新增 `backend/tests/auth-mapping-rpc.test.js` 与 `backend/tests/wallet-exchange-transfer-contract.test.js`，覆盖身份映射调用合同及双账本转账 SQL 合同。
- 更新 `docs/WALLET_API_CONTRACT_V1.md`，记录 CI、身份映射门槛和转账 SQL 草稿状态。

### 只读数据库核对
- `btcbox_auth_accounts`、`btcbox_auth_identities`、`btcbox_users`、`btcbox_user_profiles` 当前均为 0 行。
- 已确认现有 `link_btcbox_auth_account` 与 `register_btcbox_auth_identity` RPC 只授权 service_role；前者要求 `btcbox_users` 记录，而 Auth 用户初始化触发器只创建 Wallet profile/account，不创建 `btcbox_users`。这正是 0042 草稿补齐的断层。
- Wallet 余额 API 继续隐藏 available 与 frozen 都为 0 的币种；只有冻结余额大于 0 时仍显示。
- 只执行了只读 SQL；没有执行 DDL、生产数据写入、真实资金操作、环境变量修改或部署。

### 未验证 / 阻塞
- 本轮身份映射和双账本草稿在最近一次已确认 CI `43903136961` 之后新增，**新提交的 CI 结果尚未核实（NOT VERIFIED）**。
- 0042/0043 仅为仓库 SQL 草稿，未在生产或任何共享数据库执行；仍需在隔离数据库进行 SQL 集成测试和权限复核。
- `BTCBOX_AUTH_MAPPING_RPC_ENABLED` 必须保持 unset/非 1；转账 RPC 不可从 API 暴露。
- 充值地址托管/派生服务、链上 watcher、提现签名广播、外部钱包验证和 KMS/HSM 仍未配置或未完成。

**下一项唯一优先任务：** 核实本轮 backend CI 对新增测试/SQL 草稿的结果并修复失败；之后在隔离环境验证 0042/0043 的 SQL 和权限合同。保持功能分支隔离，不合并、不部署、不对生产数据库写入。


## 2026-11-17 — Referral / Rewards API 合同第一版（AI 1）

**当前分支：** `feat/wallet-api-contract-v1`  
**本次合同提交：** `dc553f7f5f70f3089105219381d096a52d5622d1`  
**新增文件：** `docs/REFERRAL_REWARDS_API_CONTRACT_V1.md`

### 已完成
- 按所有者决定采用 UI/后端并行方案：AI 2 可先做 Referral / Rewards 页面和独立 Mock 适配层；AI 1 负责后端规则、数据模型、API、安全和测试。
- 新合同定义了两级邀请关系（L1/L2）的技术边界、服务端身份归属、不可变邀请绑定、反自邀/循环约束、只按真实已结算手续费产生佣金、冲正/撤销、幂等和受控派发。
- 规划 API：`GET /api/referral/overview`、`GET /api/referral/code`、`GET /api/referral/invites`、`GET /api/referral/commissions`、`GET /api/referral/policy`；邀请链接轮换与派奖暂时禁用，等待政策审批。
- 明确 Rewards 与 Launchpad 是不同产品模块，禁止把两个入口都伪装成有效返佣入口或继续指向无关 `/trade-hub`。
- Supabase 只读核对未发现 referral/invite/reward/commission 业务表。
- 已核对现有现货撮合手续费率当前受数据库约束为 0；因此不能按成交量伪造返佣。返佣必须等待权威手续费真实扣收/结算事件。
- 明确 Mock 只能在独立 adapter 中，所有 Mock 页面标注 Demo/Preview；真实关闭状态必须如实展示 disabled/empty。

### 未完成 / NOT VERIFIED
- 尚未创建或应用返佣数据库迁移；未创建 API 路由；未产生真实返佣或派奖。
- L1/L2 费率、可返佣产品范围、币种、门槛、封顶、结算等待期、冲正与合规文案尚未得到所有者确认。
- 当前现货交易手续费仍为 0；权威 fee-settlement event 尚需定位并确认。
- 新合同文档未运行代码测试（文档提交，不适用应用构建）；尚未确认与 AI 2 的 UI adapter 对接。
- 本次未修改生产数据库、未合并 main/working、未部署。

**下一项唯一优先任务：** 先与 AI 2 对齐 UI adapter 与 disabled/demo 状态；同时在后端定位权威手续费结算事件和 Auth 用户 ID 关联字段，确认后再设计可执行迁移与 API，不提前开启真实返佣。


## 2026-11-17 — Referral fee-source investigation (AI 1)

**分支：** `feat/wallet-api-contract-v1`（隔离功能分支；与 `working` 已分歧，禁止盲目合并）  
**本轮合同更新提交：** `a8e27d3a99bbb8fedce9210bc74c0c25744b68fe`  
**本轮状态记录：** 本次同步后提交 SHA 待回读核实。

### 已完成的只读核查
- 当前 Supabase 项目 `zlozsutefnmgwwzrlipt`：`financial_matching_markets` 的 Maker/Taker fee 两条 CHECK 约束均强制为 0。
- 实际部署的 `submit_limit_order_matching_v1`：现货撮合只写买卖双方四条成交资产账本腿，不计算手续费、不扣手续费、不向手续费账户入账。
- 实际部署的 `execute_spot_trade_atomic`：只写两种交易资产账本腿，无手续费逻辑。
- 当前 Supabase 不存在任何 `perpetual_*`、`btcbox_referral_*`、invite、commission、reward 业务表。
- 仓库 `0041_perpetual_contract_v1.sql` 有未来可用的手续费路径：按 Maker/Taker 费率计算手续费、从交易者结算中扣除，并在同一成交 operation 下向保险基金账户写入 ledger；但该迁移当前未反映在连接的 Supabase 项目中，市场费率默认仍为 0。它只能视为未来候选来源，不能视为现有线上功能。
- 已确认身份映射结构：`btcbox_auth_accounts.supabase_user_id (uuid) -> btcbox_user_id (text)`；财务业务表用 `btcbox_users.user_id (text)`。返佣关系应使用服务端验证后的 canonical BTCBOX user ID，不应以 email 作为关系主键。
- 已把以上真实核查结果写入 `docs/REFERRAL_REWARDS_API_CONTRACT_V1.md`，并明确现阶段返佣必须关闭，不能从成交额伪造佣金。

### 当前阶段与未满足条件
- Referral 合同：已建立，持续完善中；不代表数据库/API 已实现。
- Referral schema/API：NOT VERIFIED / 尚未实施。
- 真实手续费源：NOT AVAILABLE（现货费率强制为 0；永续 schema 未应用；费率也未获所有者批准）。
- 返佣比例、可返佣产品、合资格交易、结算等待期、封顶、冲正、发放币种及收入分配政策：待所有者确认。
- 隔离数据库 SQL 集成测试、身份绑定端到端测试：NOT VERIFIED。
- 本轮只读核查，无生产 DDL、无写入、无真实资金操作、无部署。

### 分支基线风险
- 当前功能分支相对 `working`：ahead 85 / behind 12；merge base `2a3e6f929bf3dc1c4feee0a39c0294cbda4b717b`；`working` HEAD `1546cc0e9414776e3021017969ebf825c893cdb0`。
- 按协调规则，禁止盲目合并；后续应用代码必须先解决共同开发分支基线/整合路径，避免继续扩大分歧。
- 本轮未合并、未部署、未修改生产数据库。

**下一项唯一优先任务：** 在确定分支整合路径后，先建立可关闭的 referral code / immutable attribution 数据层和服务端身份校验测试；真实佣金记账继续被真实手续费事件与所有者政策审批双重门控。
