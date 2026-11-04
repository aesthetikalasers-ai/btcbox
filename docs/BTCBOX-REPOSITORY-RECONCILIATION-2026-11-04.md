# BTCBOX 仓库与部署对账报告（2026-11-04）

> 本报告已提交在目标仓库的独立整合分支。范围：GitHub 仓库/分支/文件树、现有协调文档、Supabase 只读结构、Vercel 项目与最近部署记录。没有修改业务代码、数据库、环境变量或部署配置；没有执行构建、测试或浏览器 E2E。

## 1. 当前结论

- **目标归档仓库：** `avali9308-code/btcboxcdt`。
- **当前主要业务源码候选：** `avali9308-code/btcbox-v33` 的 `main`，SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`。
- **目前不能声称业务代码已完整回到目标仓库，也不能声称可直接上线。** `btcboxcdt/main` 当前只有 131 个 Git tree entries，未发现自有后端、管理后台 API 或 Supabase SQL 迁移目录；`btcbox-v33/main` 有 1,722 个 tree entries，包含 BTCBOX 前端、Vercel API、后台、SQL 迁移与测试。
- 现阶段采取“保留目标仓库、先记录证据、再按文件边界移植”的方式。没有覆盖 `btcboxcdt/main`，没有合并或部署。

## 2. 仓库与分支现状

| 仓库 | 当前观察 | 结论 |
|---|---|---|
| `avali9308-code/btcboxcdt` | 默认分支 `main`；SHA `6001343a12925a3900bb3eb9afdb2e7b7d226566`；1 个分支；无 PR；131 个 tree entries | 当前是 React 前端模板，不含已识别的 BTCBOX 自有 API/管理后台/数据库迁移 |
| `avali9308-code/btcbox-v33` | 默认分支 `main`；SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`；1,722 个 tree entries | 当前 BTCBOX 业务源码候选，前后台和服务端 API 均在 `backend/` |
| `avali9308-code/BTC` | 有 AI1/AI2 研究分支及解压后的 OPEX/OpenDAX 源码 | 研究/归档仓库，不是 BTCBOX 已批准的生产源码目标；其中 OPEX Web/Admin 不是 BTCBOX 自有后台，不应整套复制进来 |

### btcbox-v33 分支

- `main`: `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`
- `backup/before-clean-20261104`: `afd3e465b492c5de3ed50b9c59cc4ee0b2395c7a`
- `chore/v33-domain-alignment`: `5608977205b1b98e3be7f469281206d5246c2882`，PR #1 已合并到 main
- `trae/agent-ZgGi7J`: `ebfb1dd5a17d061a6b773d66890d61b86212ac5f`

### btcboxcdt 分支

- 仅 `main`: `6001343a12925a3900bb3eb9afdb2e7b7d226566`
- 旧协调文档所称的 `develop` 分支当前不存在；旧基线 SHA、PR #15 与旧 Preview SHA 不可直接作为当前验收基准。

## 3. BTCBOX 自有前后台代码定位

当前源码候选 `btcbox-v33/main` 中：

- 后台页面：`backend/admin.html`
- API 适配入口：`backend/api-adapter.js`
- API 核心：`backend/api-core.js`
- Vercel catch-all：`backend/api/[...path].js`
- Vercel 健康检查：`backend/api/healthz.js`
- 路由与部署：`backend/vercel.json`
- 前端交互：`backend/assets/js/app-core.js`、`backend/assets/js/views-account.js` 等
- 构建/测试：`backend/package.json`、`backend/scripts/build-site.js`、`backend/tests/`
- 数据库迁移：`backend/supabase/sql/0001_...sql` 至 `0022_...sql`

后台路由由 `backend/vercel.json` 将 `/admin` rewrite 到 `/admin.html`。后台交互位于现有应用的 admin view，当前文档记录的主要栏目为用户、充值、提现、KYC。后台 API 使用独立 HTTP Basic Auth，凭据从服务端环境变量读取；不能把管理员密码放进前端代码或 Git 文档。

后台 API 合同覆盖统计、用户查询/详情、冻结/余额调整、充值确认、提现审批/拒绝、KYC 审核、提现列表、地址、订单、客服消息与配置等。具体实现和 UI 覆盖范围仍需逐条对照，不应把 API adapter 声明等同于每个功能都有可用 UI。

## 4. Supabase 现场只读快照

已连接项目：`zlozsutefnmgwwzrlipt`。

- 识别到 14 张业务表：`btcbox_state`、`deposit_records`、`earn_positions`、`earn_product_catalog`、`financial_accounts`、`financial_audit_log`、`financial_ledger`、`financial_matching_markets`、`financial_matching_orders`、`financial_matching_trades`、`financial_operations`、`financial_spot_orders`、`seconds_contract_positions`、`withdrawal_requests`。
- 识别到 22 个由服务端使用的业务 RPC；Edge Functions 数量为 0。
- 业务表已启用 RLS；本次读取的 `pg_policies` 未发现 public/authenticated policies。当前设计可能是仅由 Vercel server-side service-role 调用；必须继续核对实际访问路径与授权边界，不能仅凭 RLS 开启就判定安全验收通过。
- 业务表记录量目前很少；此快照不代表交易、充值、提现流程已通过运行测试。

## 5. Vercel 项目与部署对账

Vercel 团队 `BOX` 下同时存在两个项目，并且均与 GitHub 有关联：

| Vercel 项目 | 最新部署 | Git 来源 | 状态 |
|---|---|---|---|
| `btcbox-v33` | `dpl_FVkD98o4uDr6a1AwdKPwUj6w9NxC` | `btcbox-v33/main`，SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07` | READY（Production target） |
| `btcboxcdt` | `dpl_FWbbjTYgsB2fXDt6UXDuRZHjn9Hh` | `btcbox-v33/main`，同一 SHA | ERROR（Production target） |

`btcboxcdt` 项目最近一次构建日志显示：Vercel 检出的是 `btcbox-v33`，但该项目按 Vite 执行 `vite build`，随后因 `vite: command not found` 退出（ENOENT / exit 127）。这说明项目构建设置与当前源码构建入口不匹配。相同源码 SHA 在独立的 `btcbox-v33` Vercel 项目上显示 READY。

READY 只代表该次 Vercel 构建/部署状态，不等于 API、认证、后台、资金流程或浏览器 E2E 已验收。没有执行任何部署操作。

## 6. 当前阻断项（按优先级）

### P0 — 先处置凭据与资金开关文档冲突

1. `backend/DEPLOYMENT.md` 含有疑似真实的后台管理员口令字面值。报告不复述该值。应将其视为已暴露凭据：立即在 Vercel 轮换 `ADMIN_PASS`，确认新值仅存在于 Vercel 环境变量/受控密钥存储，并从版本库文档中移除。若该值曾被实际使用，还应检查访问记录。不要把它复制到目标仓库。
2. 同一份 `backend/DEPLOYMENT.md` 将四个 `FINANCIAL_*` 开关写为 `1`；但 `backend/VERCEL-DEPLOYMENT.md` 和 `backend/README.md` 要求正式验收前全部显式为 `0`，部署 preflight 也要求显式关闭。必须统一文档，并在未完成独立资金验收前保持关闭。当前 Git 文档不能证明 Vercel 实际环境变量值。

### P1 — 提现生命周期未闭环

已有审查记录指出：`review_withdrawal_atomic` 审批后把提现状态改为 `approved` 并扣减冻结金额，但目前审查到的合同未包含链上广播任务领取、txid 持久化、广播失败重试、链确认和终态处理；待审批查询只返回 pending。生产提现不能据此视为可用。需要完成 durable outbox/broadcaster 与状态机，再做独立测试。

### P1 — 构建与集成目标不一致

- `btcbox-v33/backend/package.json` 要求 Node 22，构建脚本为 `npm run build`，测试为 `npm test`；`backend/vercel.json` 的 build command 为 `npm run build && npm test`，输出目录为 `dist`。
- `btcboxcdt` 当前根目录是另一套 React 19 / react-scripts 项目；不能把 v33 的 backend 代码直接覆盖到根目录，也不能把两个 package.json/lockfile 合并。
- 必须先决定目标部署的 Root Directory、构建命令、输出目录和 Git 源仓库，再分批移植。

### P1 — 认证和后台真实浏览器验收仍缺失

源码可见 Email/Google 认证与后台 Basic Auth 的实现，但配置存在不等于真实浏览器登录通过。需要对当前目标 SHA 做 Google OAuth 回调、会话恢复、后台认证、未授权拒绝、用户冻结等浏览器测试。没有证据的项目一律标记 NOT TESTED。

## 7. 建议的整合顺序

1. 先轮换并移除仓库中的后台口令；统一资金开关文档并保持关闭。
2. 将 `btcbox-v33/main` 作为业务代码来源候选，保留 `btcboxcdt/main` 当前文件和交易页布局，不直接覆盖。
3. 在 `btcboxcdt` 的独立整合分支逐批移植：先 API/部署骨架，再认证与 Supabase 适配，再后台页面与 API，再其他业务视图；每批单独 diff、测试和审查。
4. 对接已有 Supabase 时逐项比对迁移文件、RPC 签名、表结构与当前线上 schema；不得盲目重跑或覆盖已有数据。
5. 完成提现广播闭环、构建测试和浏览器 E2E 后，才提交验收结论。生产部署仍需明确批准。

## 8. 本次执行记录

- 目标仓库：`avali9308-code/btcboxcdt`
- 基线：`main` @ `6001343a12925a3900bb3eb9afdb2e7b7d226566`
- 源码候选：`avali9308-code/btcbox-v33` @ `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`
- 本报告：`docs/BTCBOX-REPOSITORY-RECONCILIATION-2026-11-04.md`
- 状态：SOURCE OBSERVED；构建/自动化测试/浏览器 E2E 均 NOT TESTED。
- 本次未修改业务代码、Supabase schema/RPC、Vercel 环境变量；未合并；未部署。
