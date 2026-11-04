# BTCBOX 前后台整合合同矩阵（2026-11-04）

## 目的与边界

本文件把当前 `main` 中 Strata Pro React 前端与 BTCBOX 既有后端 API 的实际源码合同放在一起，作为整合实施依据。它是源码审查，不是运行验收；任何标记为“源码存在”的接口，都不能据此宣称已在 Vercel、Supabase 或浏览器中成功运行。

- 仓库：`avali9308-code/btcboxcdt`
- 审查基线：`main`，当前已观察到的提交 `efa7c2c3fc7706c43c463b50a4400f77551d4611`
- React 前端：`frontend/`（Vite + React + TypeScript）
- BTCBOX API 与管理后台：`backend/`（Vercel Node Function + 既有 HTML 管理台）
- 本文不修改业务逻辑、数据库、Vercel 设置、生产环境变量或部署。

## 1. 当前部署失败的直接原因

最近一次可查的 Vercel Preview：

- Deployment：`dpl_9AHYrDMgGo3wMcgj6hiFESSzDrSQ`
- Branch / SHA：`feature/btcbox-react-frontend-20261104` / `425b0c3828ae1d1920877c78d8e735b98dbfffed`
- Build entrypoint：`.`
- 实际执行：根目录 `yarn run build` → `react-scripts build`
- 失败：`TS2307: Cannot find module 'lucide-react'`

根目录 `package.json` 是旧 CRA 应用，没有 `lucide-react`；`frontend/package.json` 才包含 `lucide-react`，并定义 Vite build。由此可确认：这次 Vercel 构建没有在 `frontend/` 内执行 Vite build。问题不应通过把 `lucide-react` 随意加进根目录来掩盖，因为那仍然会构建错误的旧应用。

前端独立 CI 曾在 PR #6 的精确 head `befb8a9c0eb6ff99c1d01459ffb5be070c133965` 通过 `npm run lint` 与 `npm run build`；这证明当时的 frontend workspace 构建通过，不证明当前 Vercel 项目或前后台联合部署通过。

## 2. 推荐的单域名部署结构（待实现与验证）

目标是让 React 用户前台、现有 API、管理后台在同一个 Vercel 项目和同一域名下提供服务：

1. Vercel 项目 Root Directory 采用 `backend`，让现有 `backend/api/[...path].js`、`backend/api/healthz.js` 和 `backend/vercel.json` 保持在函数识别根目录。
2. 启用 Vercel 的 `sourceFilesOutsideRootDirectory`，使构建过程可读取仓库中的 `frontend/`。
3. 构建时先安装并构建 `frontend/` 的 Vite workspace，再运行后台的静态构建与测试。
4. 将 Vite 的 SPA 输出合并进 `backend/dist/`，由现有 API Function 同域提供 `/api/*`。
5. React 静态资源使用独立目录名（建议 `frontend-assets/`），避免覆盖后台管理台仍依赖的 `backend/assets/`。
6. 保留 `/admin`、`/admin.html`、`/oauth/consent`、`/auth/callback` 等既有入口；React SPA 的页面路由回退不能吞掉这些专用入口。
7. 必须在 Preview 对首页、React 深层路由、`/api/healthz`、`/api/market`、`/api/kline`、`/admin` 与 OAuth 回调逐项验证后，才考虑生产切换。

这条路线需要配套修改 Vercel 项目设置和后台构建脚本。本文仅记录建议，不会自行修改线上设置。若后台处理者已经在改同一文件，应先对齐改动再合并。

## 3. 前端当前实际调用

| 前端能力 | 当前实现 | 真实后端合同 | 状态 |
|---|---|---|---|
| 市场行情 | `getMarkets()` | `GET /api/market`，成功载荷包含 `ok: true` 与 `markets[]` | 已接入源码；待联合部署验证 |
| K 线 | `getKlines(symbol, interval)` | `GET /api/kline?symbol=...&interval=...`，成功载荷包含 `klines[]` | 已接入源码；待联合部署验证 |
| 深度 | 尚无前端调用 | `GET /api/depth?symbol=...`，返回 `bids[]` / `asks[]` | 未接入 |
| 登录 / 注册 | 当前是占位页 | 仅 `POST /api/supabase-login` 接受经 Supabase 验证的 Google identity；`POST /api/login` 与 `/api/register` 明确返回 `403 GOOGLE_ONLY_AUTH` | 未接入；Email/Google 方案不一致 |
| 账户 / 资产 | 当前是占位或预览状态 | `GET /api/account`，需 session cookie | 未接入 |
| 订单列表 | 当前是占位页 | `GET /api/orders`，需登录；匹配引擎未启用时不提供 PostgreSQL 订单查询 | 未接入 |
| 现货下单 / 撤单 | 当前交易页不是完整订单表单 | `POST /api/order` 仅接受 limit order；`POST /api/order/cancel`；均需匹配引擎获批 | 未接入；不可显示成可交易 |
| 充值 | 当前是占位页 | `POST /api/deposit` 金额为 0 时只返回充值地址；正金额请求明确拒绝，不会创建待入账订单 | 未接入；完整充值链路未实现 |
| 提现 | 当前是占位页 | `POST /api/withdraw` 需地址白名单、资金密码、幂等键、可能 2FA 与财务 RPC | 未接入；线上 RPC 签名仍有审查阻断项 |
| Earn | 当前是占位页 | `POST /api/earn` subscribe/redeem，财务写入未获批时返回 503 | 未接入 |
| Seconds | 当前是占位页 | `POST /api/seconds/order`、`POST /api/seconds/settle`、`GET /api/seconds/positions` | 未接入；财务写入未获批时 fail-closed |
| KYC | 当前是占位页 | `POST /api/kyc`；审核状态从 `GET /api/account` 读取 | 未接入 |
| 客服 | 当前是占位页 | `POST /api/support/chat`、`GET /api/support/messages` | 未接入 |
| 安全设置 | 当前是占位页 | `POST /api/2fa/enable`、`confirm`、`disable`，及密码/资金密码接口 | 未接入 |

所有账户类 API 依赖后端 session cookie。前端 API client 应继续使用 same-origin `/api` 与 `credentials: "include"`，不要把 service-role key 或管理后台凭据放入浏览器。

## 4. 认证必须先统一

后端源码当前将 Email/password 登录和注册明确关闭，Google Supabase identity 是唯一允许的登录入口：

- `POST /api/login` → 403 `GOOGLE_ONLY_AUTH`
- `POST /api/register` → 403 `GOOGLE_ONLY_AUTH`
- `POST /api/supabase-login` / `google-login` → 验证 Supabase access token，并要求 identity 为 Google-only。
- `GET /api/auth-health` → 检查服务端 Auth 环境与 Google provider 状态。

Supabase 控制台开启 Email Auth，不等于 BTCBOX 后端已经支持 Email 登录。若产品决定同时支持 Email 与 Google，必须先设计并实现统一身份绑定、Email 确认/恢复与 session 建立流程，再开放对应前端入口；不能只在 UI 中增加邮箱表单。

## 5. 资金功能不可被前端“做成可用”来掩盖后端阻断

从当前源码可确认：

- 现货下单只接受 limit order；matching engine 未获批时返回 503，不会模拟成交。
- Earn、Seconds、提现依赖财务写入开关；未获批时应在 UI 中明确显示不可用。
- 充值金额大于 0 的用户请求目前明确拒绝；取地址不等于生成充值订单。
- 既有审查已指出 live `create_withdrawal_atomic` 签名与源码调用不匹配，迁移 0021/0022 与线上 schema 有冲突；禁止直接应用旧迁移文件。
- 提现审批不是链上转账完成；必须有广播、txid 持久化、重试和确认终态，才能向用户显示已完成。

在真实 Preview API/E2E 证明前，前端只能呈现“未接通 / 暂不可用 / 等待审核”等真实状态，不能用模拟余额、模拟成交、模拟充值或模拟提现替代。

## 6. 已发现的图表交互与移动端待修项

源码检查发现一项会误导用户的图表行为：

- `Dashboard.tsx` 只在页面加载时请求一次 `getKlines("BTCUSDT", "1h")`。
- `LiquidityChart` 的范围按钮（1h、6h、24h、7d、30d）只改变 Lightweight Charts 的可视逻辑区间，没有重新请求匹配周期的数据。
- `VolumeChart` 的 1d、7d、30d 按钮也只改变可视区间，却继续使用同一份 1h K 线。
- Zustand 初始范围分别为 30d 和 7d，而当前只取后端最多 100 根 1h K 线，实际覆盖范围不足以支撑 30d/7d 标签。

因此，目前图表按钮属于“视窗切换”，不是完整的时间周期切换；默认 30d/7d 也没有相应历史跨度。修复时应将按钮状态映射到后端已支持的 interval（1m、3m、5m、15m、30m、1h、2h、4h、1d），按当前选中范围请求相应数据，并在请求期间显示 loading；失败时保留清晰的错误/空状态，不得静默退回未标识的假数据。前端与 API 的周期映射必须明确测试。

移动端源码初检：
- 主壳使用 `h-dvh`、`min-w-0`、底部 safe-area padding 与移动底部导航，具备基本响应式基础。
- 行情表格设定 `min-w-[700px]` 并在外层横向滚动；小屏可查看，但必须在 320–430px 实机/浏览器宽度确认滚动提示、列可读性与触控体验。
- 目前没有本轮真实设备截图或浏览器 E2E 证据；不能标记手机适配验收通过。

## 7. 验收清单

### 构建与部署
- [ ] Vercel 构建日志显示在正确 workspace 执行 Vite build，而不是根目录 CRA build。
- [ ] 输出目录包含 React `index.html`、React 静态资源、既有 `admin.html`、OAuth consent 文件及必要的后台静态资源。
- [ ] `/api/healthz` 返回 JSON 200。
- [ ] `/api/market` 与 `/api/kline` 从同域成功返回。
- [ ] `/home`、`/markets`、`/trade/BTCUSDT` 等 React 深层路由刷新后仍正确加载。
- [ ] `/admin` 仍进入后台入口；后台数据与动作仍由服务端 Basic Auth 保护。
- [ ] OAuth 回调、登出、会话恢复完成浏览器测试。

### 前台功能
- [ ] Google OAuth 登录、回调、session cookie、页面刷新恢复。
- [ ] Email 登录/注册的产品决定和后端合同一致；否则不要展示 Email 可用入口。
- [ ] 账户、余额、订单、充值地址、KYC、客服、安全设置逐项对照 API 载荷和错误状态。
- [ ] 交易表单只允许后端支持的订单类型，并正确处理 503 / 幂等重试。
- [ ] 充值与提现的 UI 状态不得超出真实后端生命周期。

### 手机与桌面
- [ ] 320、360、375、390、414、430 px。
- [ ] 平板、桌面、横屏与 iOS safe-area。
- [ ] 图表、订单表格、底部导航、弹窗和键盘弹起场景无横向溢出或遮挡。

## 8. 证据来源

- `frontend/package.json`、`frontend/vite.config.ts`、`frontend/src/lib/api.ts`、`frontend/src/App.tsx`
- `backend/api-core.js`、`backend/api-adapter.js`、`backend/api/[...path].js`、`backend/api/healthz.js`
- `backend/package.json`、`backend/scripts/build-site.js`、`backend/vercel.json`
- Vercel deployment `dpl_9AHYrDMgGo3wMcgj6hiFESSzDrSQ` build logs
- PR #6 validation notes and backend launch-readiness audit

**结论：** 当前已具备可用作整合基础的 React 前端和 BTCBOX API 源码，但它们尚未成为一个通过联合构建、同域 API、认证和业务流程验收的产品。下一阶段首先应解决部署 workspace 与静态产物合并，再按上述矩阵逐项接通前端。
