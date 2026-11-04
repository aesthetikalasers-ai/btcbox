# BTCBOX 后台上线就绪审查（2026-11-04）

审查基线：`main` / `0b68853eac5c4655db1112b30a7489fd16154c4c`。范围：恢复后的 `backend/`、Vercel 项目/部署元数据、Supabase 实际表结构/RPC/权限/迁移记录/advisors。仅只读检查；未执行 SQL 写入、环境变量修改、部署或资金操作。

## 结论

**后台暂不具备生产资金业务上线条件。** 源码已进入 `btcboxcdt/main`，但当前核查到的 Vercel Production 部署仍来自另一个仓库 `btcbox-v33` 的旧 SHA。充值申请与提现审核/广播流程也存在实际契约缺口。

## P0 — 部署目标不一致

- 当前返回的 Vercel 项目名称为 `btcbox-v33`，域名为 `btcbox-v33.vercel.app` / `btcbox-v33-box-2753.vercel.app`。
- 最新 Production deployment READY，但 Git source 是 `avali9308-code/btcbox-v33` / `main` / SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`，不是本仓库当前 `0b68853eac5c4655db1112b30a7489fd16154c4c`。
- 此前检查的另一个 `btcboxcdt` Vercel 项目部署失败，日志为 `vite: command not found`；而本后台的 Node 构建入口在 `backend/package.json`。
- 需要先确认唯一生产 Vercel 项目，连接 `avali9308-code/btcboxcdt`，并将 Root Directory 配置为 `backend`，再从准确 SHA 创建 Preview 验证。**本轮未更改任何 Vercel 设置或部署。**

## P1 — 已确认业务阻断

### 1. 提现 RPC 参数与线上数据库不匹配

- `backend/api-core.js` 调用 `create_withdrawal_atomic` 时传入 `p_require_admin_review`。
- Supabase 当前实际函数签名为 `create_withdrawal_atomic(p_withdrawal_id text, p_user_id text, p_asset text, p_network text, p_amount numeric, p_fee numeric, p_destination text, p_request_id text, p_request_hash text)`，没有该参数。
- 因此当前 PostgREST 无法按调用参数解析该 RPC。资金开关当前设计为 fail-closed，不能为了绕过问题而启用资金开关。

### 2. SQL 迁移 0022 与实际数据库结构冲突

- `backend/supabase/sql/0022_withdrawal_admin_review_status_v1.sql` 创建 TEXT 参数重载，并引用 `public.withdrawals` / `withdrawal_id`。
- 实际数据库表为 `public.withdrawal_requests`，主键列为 `id`，金额列为 numeric；线上当前 RPC 也读取 `withdrawal_requests`。
- 该迁移不能正确更新当前实现，函数执行到错误表名时会失败；它还把函数改为 `SECURITY DEFINER`，与当前线上 `SECURITY INVOKER` 不同。
- 应重写为针对实际表结构与精确 RPC 签名的迁移，并在隔离 staging 验证。**禁止直接将当前 0022 应用到生产。**

### 3. 提现审核后没有链上广播闭环

- 线上 `read_admin_withdrawal_snapshot_v1` 只统计/返回 `status='pending'`。
- 线上 `review_withdrawal_atomic` 批准后将状态改为 `approved`，并扣减冻结余额；API 文案明确说明批准不代表已广播。
- 当前检查到的后台/SQL 没有持久化广播任务领取、txid 写入、广播失败重试、链上确认、完成/补偿终态流程。
- 管理界面也只筛选 `status === 'pending'`，不包含 `pending_admin_review`。
- 必须补齐幂等 outbox/broadcaster 状态机，批准时不能让记录从待处理队列消失。提现资金切换保持关闭。

### 4. 充值申请/人工审核链路不完整

- 后台 README 明确：用户充值接口目前只返回充值地址，不创建待处理充值订单。
- 管理 UI 有待审核充值入口，但没有已确认的用户充值申请流程向其提供订单。
- 线上 `confirm_deposit_atomic` 明确拒绝未完成链上验证的手工确认；这是 fail-closed 保护，不应为让按钮成功而移除。
- 需要建立充值观察/申请记录、链上验证与幂等入账流程后，才能开放充值确认。

### 5. /admin 入口可能落到首页

- `backend/vercel.json` 将 `/admin` rewrite 到 `/admin.html`。
- `admin.html` 是通用 SPA shell；`boot.js` 在没有 hash 时设置 `#/home`。
- 管理视图注册在 `#/admin`，并非由 `/admin` pathname 直接选择。
- 需修复并验证真正的管理后台入口；不能只凭 rewrite 存在就认为入口可用。

## P2 — 配置与迁移治理

### 6. Supabase migration history 与仓库文件不一致

- 仓库有 24 个 `backend/supabase/sql/` SQL 文件。
- Supabase migration history 当前只显示两个版本：`20261102133555`、`20261103062716`。
- 实际数据库已有核心表和 RPC，因此不能据此断言 SQL 未执行；但仓库文件和迁移账本无法证明一一对应。需要逐项核对线上 schema/function 后建立规范迁移历史，禁止盲目重放。

### 7. 管理员密码长度规则不一致

- Runtime 注释/校验要求至少 12 位并含大小写、数字、符号。
- `backend/scripts/deployment-preflight.js` 要求 `ADMIN_PASS` 至少 16 位。
- 统一 runtime、preflight 和文档规则，避免一个门禁通过、另一个门禁失败。

### 8. Supabase advisors

- 检查到的 14 张 public 表均启用 RLS，但无 policy；直接权限检查显示 `anon` 与 `authenticated` 对这些表没有 SELECT/INSERT/UPDATE/DELETE 权限。这与服务端专用访问模型相符，不能为了消除 INFO 提示而给所有表添加宽泛客户端 policy。
- 检查到的 public RPC 不允许 `anon` / `authenticated` 执行；检查到的 SECURITY DEFINER helper 也未授权给这两个角色。
- Supabase 另提示 leaked-password protection 未启用（WARN）及 5 个外键缺少覆盖索引（INFO），属于加固/性能后续项。

## 正面发现

- 后台 API 使用 HTTP Basic Auth；凭据比较采用 `timingSafeEqual`，失败计数持久化并在 5 次失败后锁定 15 分钟。
- 管理后台 HTML shell 本身不是权限边界，敏感管理 API 有 Basic Auth 检查。
- 资金相关开关默认关闭，preflight 要求四个资金开关明确设置为 `0`。
- public `anon` / `authenticated` 角色当前没有直接业务表权限。

## 验证边界

- 已检查源码、Supabase schema/RPC 参数/表权限/函数权限/迁移历史/advisors，以及 Vercel 项目与部署元数据。
- `npm run build`、`npm test`、`npm run preflight`：本轮执行环境未能运行，**未验证**。
- 浏览器/API E2E：未运行。
- 数据库写入、Vercel 环境修改、生产部署、资金操作：均未执行。
- 进一步 Vercel 读取在本轮遇到 team scope 403，故未继续更改或读取项目设置。

## 发布判定

保持资金相关开关关闭。P0 部署目标、P1 充值/提现生命周期与 RPC/迁移契约完成后，必须针对精确 SHA 通过 build、tests、preflight、Preview 浏览器/API 测试，才可讨论生产发布。
