# BTCBOX — Phase 0 Baseline Evidence Report (AI 1补证)

- 审计分支：`audit/phase-0-baseline-evidence-20261111`
- 基线提交：`525cc9d6c72140f3778ae295e46f1338482189cc`
- 仓库：<https://github.com/aesthetikalasers-ai/btcbox>
- 本报告性质：Phase 0 补证记录；**不是 AI 2 验收，也不签发 PASS**。
- 执行边界：只读核查及本审计分支新增报告；未修改应用源码、交易业务、生产配置；未合并、未部署、未执行资金/金融写入。

## 1. 基线和证据范围

AI 2 指定的基线 `525cc9d6` 与本轮读取的 `main` 源码及 Frontend CI checkout SHA 一致。CI 日志记录实际 checkout SHA 为 `525cc9d6c72140f3778ae295e46f1338482189cc`。

主要源码：
- [React 路由入口](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/frontend/src/App.tsx)
- [Vercel 路由/重写配置](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/backend/vercel.json)
- [统一站点构建脚本](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/backend/scripts/build-site.js)
- [API adapter](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/backend/api-adapter.js)
- [API catch-all function](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/backend/api/[...path].js)
- [静态 OAuth consent 页面](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/backend/oauth/consent.html)

## 2. 页面、路由和发布入口校准

### 2.1 React 客户端页面路由

依据 `frontend/src/App.tsx`。除注明外，页面由 React SPA 处理；登录保护只表示客户端路由守卫，不等于生产访问验证。

| 路径 | 页面/组件 | 路由保护或说明 |
|---|---|---|
| `/home` | Dashboard | 公共客户路由 |
| `/markets` | MarketsPage | 公共客户路由 |
| `/trade-hub` | TradeHubPage | 公共客户路由 |
| `/trade/:symbol` | SpotTradingPage | 公共现货交易页面 |
| `/seconds` | SecondsPage | ProtectedAccountRoute |
| `/contract` | ContractPage | ProtectedAccountRoute |
| `/assets` | AssetsPage | ProtectedAccountRoute |
| `/orders` | OrdersPage | ProtectedAccountRoute |
| `/deposit` | DepositPage | ProtectedAccountRoute |
| `/withdraw` | WithdrawPage | ProtectedAccountRoute |
| `/earn` | EarnPage | ProtectedAccountRoute |
| `/me` | MyPage | 客户路由；页面内部行为仍需单独核实 |
| `/settings` | AccountSecurityPage | ProtectedAccountRoute |
| `/kyc` | KycPage | ProtectedAccountRoute |
| `/support` | SupportPage | 公共客户路由 |
| `/login` | AuthPage(login) | 独立认证布局，不渲染 AppLayout |
| `/register` | AuthPage(register) | 独立认证布局，不渲染 AppLayout |
| `/account-setup` | AccountSetupPage | 独立认证布局 |
| `/auth/react-callback` | AuthCallbackPage | 独立认证布局 |
| `/admin` | AdminPage | App.tsx 顶层独立路由；固定 zh-CN，不经过客户 AppLayout |

### 2.2 重定向、静态页面、API 和旧版资源

| 类型 | 路径/入口 | 源码依据 | 发布状态判断 |
|---|---|---|---|
| React 内重定向 | `/trade` → `/trade-hub` | `frontend/src/App.tsx` | SPA 内可达；仍需生产环境逐路径实测 |
| React 内兜底 | 未匹配客户路由 → `/home` | `frontend/src/App.tsx` | SPA 内兜底 |
| Vercel 重定向 | `/admin.html` → `/admin` | `backend/vercel.json` | 配置存在；实际域名行为未逐条请求验证 |
| Vercel 重定向 | `/auth/callback` → `/auth/react-callback` | `backend/vercel.json` | 配置存在；实际域名行为未逐条请求验证 |
| 静态兼容页面 | `/oauth/consent` → `/oauth/consent.html` | `backend/vercel.json`、`backend/oauth/consent.html`、`backend/oauth/consent.js` | 构建脚本明确保留 oauth 目录；CI 也验证产物中存在 |
| SPA 静态入口 | `/index.html` | `backend/index.html` 被 React build 产物覆盖 | React SPA 是客户/管理应用的统一入口 |
| API 通配入口 | `/api/*` → `/api/router`；另有 `/api/[...path]` | `backend/vercel.json`、`backend/api/router.js`、`backend/api/[...path].js`、`backend/api-adapter.js` | Vercel Function 入口配置存在；具体 endpoint 由 `backend/api-core.js` 的共享 handler 处理 |
| API 健康检查 | `/api/healthz` | `backend/api/healthz.js` | 源码入口存在；本轮未对用户生产域名发请求 |
| 旧版 HTML/JS/CSS | `backend/index.html` 中旧版视图脚本及 `backend/assets/js/*` | `backend/scripts/build-site.js` | 旧版资源仍在仓库；allowlist 构建只复制 React SPA 入口、React assets、OAuth 页面和必要 tokens CSS；CI 明确断言产物没有 `legacy-index.html`、`admin.html`、`assets/js`、`api` 目录 |

**限制：** GitHub 源码和构建配置只能证明预期产物结构，不能单独证明每条路径在用户访问的 Production 域名上运行正确。完整生产路由验收仍待补。

## 3. 桌面语言菜单重复入口

AI 2 的问题经本轮重新读取源码确认：

- `AppLayout.tsx` 在 `lg:block` 下从 1024px 显示桌面 Sidebar；手机抽屉也复用 Sidebar。
- `Sidebar.tsx` 无条件渲染 `<LanguageMenu variant="drawer" />`。
- `Topbar.tsx` 同时无条件渲染默认 `<LanguageMenu />`。
- AppLayout 在所有非独立认证路由中同时挂载 Sidebar 与 Topbar。

据此，**桌面 1440px 与 1024px 的 Shell DOM 结构会同时包含 Sidebar 和 Topbar 两个语言菜单组件实例**；390px 初始视图 Sidebar 仅在关闭的移动抽屉内，Topbar 仍有一个菜单入口。由于本轮未取得实时浏览器 DOM/截图，入口是否可见、弹层交互和可访问性树仍标为待实测，不能把组件实例数等同于截图可见数。

建议最小修复方向（本轮未修改）：桌面 Sidebar 隐藏 drawer 语言入口，仅在移动抽屉实例保留；或按明确 viewport 条件只显示一个入口。需通过 1440/1024/390 三个宽度的 DOM + screenshot 回归，再由 AI 2 审查。

源码：
- [AppLayout.tsx](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/frontend/src/components/layout/AppLayout.tsx)
- [Sidebar.tsx](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/frontend/src/components/layout/Sidebar.tsx)
- [Topbar.tsx](https://github.com/aesthetikalasers-ai/btcbox/blob/525cc9d6c72140f3778ae295e46f1338482189cc/frontend/src/components/layout/Topbar.tsx)

## 4. Frontend CI 失败逐项记录

原始运行：[Frontend CI run 42905110305](https://github.com/aesthetikalasers-ai/btcbox/actions/runs/42905110305)

GitHub Actions job：`build`，job ID `130140950103`。步骤 1–9 成功（安装、i18n、TypeScript lint、Decimal、Vite build、Chromium 安装）；第 10 步 `Run desktop and mobile route smoke tests` 失败；截图上传步骤成功。日志最终统计：**142 passed、33 failed、11 skipped**，退出码 1。33 个失败不是 33 种不同逻辑：17 个不同测试在 desktop/mobile 两项目重复失败，其中 responsive visual QA 的 /home 测试只在 desktop 项目运行，因此总数为 33。

| 测试用例（源码行） | 项目 | 失败断言/日志表现 | 初步分类与影响 |
|---|---|---|---|
| trade chooser exposes exactly the four customer products (Spot/Seconds/Contract/Earn) without a Futures entry — `auth-routes.spec.ts:968` | desktop + mobile | `getByText('Unavailable', exact:true)` 未找到（断言位于约 986 行） | 页面状态文案/测试预期待核；可能影响入口状态展示；需核对组件真实文案和业务产品定义 |
| public preview landing page is available signed out with market data and registration entry points — `:1014` | desktop + mobile | `Market overview` heading 未找到（约 1037 行） | 页面标题/访客首页契约不一致；可能是产品缺陷或过时断言 |
| public preview distinguishes server snapshot time from upstream provider time — `:1164` | desktop + mobile | 等待 `Market data` 文本的 click 超时（约 1178 行） | 目标控件缺失或标签已变更；尚无法判断 |
| public market preview remains responsive across mobile, tablet and desktop widths — `:1257` | desktop + mobile | `Market overview` heading 未找到（约 1282 行） | 先决页面断言失败，响应式断言未真正完成；不能视为 viewport 通过 |
| language preference updates the document locale and persists across reloads — `:1324` | desktop + mobile | `getByRole('combobox',{name:'Language'})` 的 selectOption 超时（约 1329 行） | 测试把语言菜单当原生 select；源码组件是自定义 LanguageMenu，疑似测试预期过时，但需交互回归 |
| a first-time visitor sees Japanese and can switch to another language — `:1339` | desktop + mobile | `combobox` 名称“言語”未找到（约 1352 行） | 同上，测试 locator 与自定义菜单语义不匹配的可能性高 |
| languages load on demand, cache in memory and persist across navigation and reload — `language-loading.spec.ts:17` | desktop + mobile | 语言控件/加载状态断言失败；具体步骤需结合该测试失败上下文进一步核验 | 语言加载功能不能判定通过；分类待核 |
| a timed-out market refresh hides previous quotes and a later refresh recovers — `market-feed-fail-closed.spec.ts:21` | desktop + mobile | 市场刷新状态/报价恢复断言失败 | 可能是真实行情 fail-closed 缺陷，也可能是测试 mock 与当前请求契约不一致；高优先级待核 |
| public dashboard shows an unavailable state and no quote values when the market feed fails — `:44` | desktop + mobile | 不可用状态/报价断言失败 | fail-closed 行为尚未被测试证明；高优先级待核 |
| a live public market pair opens its spot trading page — `:86` | desktop + mobile | 市场交易对链接/跳转断言失败 | 可能影响市场到现货交易入口；需核对 mock 数据和链接可访问名称 |
| public dashboard hides quotes from an expired server market snapshot — `:111` | desktop + mobile | 过期快照状态/报价隐藏断言失败 | 行情陈旧数据保护尚未证明；高优先级待核 |
| desktop resize releases the mobile modal and navigation links close it — `navigation-accessibility.spec.ts:25` | desktop + mobile | resize 后 modal/navigation 状态断言失败 | 可能是真实响应式导航/焦点管理问题；需单独回归 |
| market favorites persist, sorting changes rows, and ETH opens its own pair — `redesign.spec.ts:25` | desktop + mobile | 首个可见 spot trading link accessible name 不符合 `BTC spot trading` | 可能是链接名称、数据排序或页面渲染缺陷；也可能是测试 locator 过时 |
| official logo and compact market workspace fit narrow viewports — `:64` | desktop + mobile | `Market overview` heading 未找到，后续 logo/overflow 断言未执行 | 视觉测试先决条件失败；不能据此判定 logo 或窄屏通过/失败 |
| configuration outage preserves protected route and offers recovery instead of a login loop — `:78` | desktop + mobile | 预期完整 session restoration 错误文案未找到 | 可能是错误态 UI 缺陷或状态触发条件/mock 时序问题 |
| Chinese administration preserves the customer language preference — `:111` | desktop + mobile | 从 Admin 返回后 `Market overview` heading 未找到 | 管理页返回后的客户首页/语言保持尚未验证；可能是页面标题预期过时或导航问题 |
| responsive visual QA /home fits every viewport — `responsive-visual-qa.spec.ts:21` | desktop only | /home 的 `Market overview` heading 不可见，循环中断 | 该测试未生成 /home 的 8 个 viewport 截图；不能将其列为通过 |

**共同环境背景：** CI 的 E2E 明确使用 `btcbox-e2e.invalid`、拦截 `/api/auth-client-config` 与 `/api/account` 并注入隔离响应；不是连接真实 Supabase 或生产行情。这个事实说明测试环境是隔离 mock 环境，但不能自动把失败归咎于环境。必须逐项检查 mock 请求路径、页面 DOM 和组件契约。当前分类均为“疑似/待核”，没有足够证据宣称生产功能已受影响或无影响。

回归建议：先修正过时 locator（自定义语言菜单不应使用原生 selectOption），再对行情 fail-closed、市场交易对跳转、导航 modal resize、认证超时恢复建立独立且稳定的 fixture 测试。AI 2 需审阅测试变更和产品行为后确认分类。

## 5. Phase 0 页面审计矩阵（现有证据，不推定通过）

### 5.1 已存在的视觉截图矩阵

CI 文件 `frontend/e2e/responsive-visual-qa.spec.ts` 声明 8 个宽度：**320、360、375、390、430、768、1024、1440px**；11 条路径：login、register、home、markets、trade/BTCUSDT、trade-hub、assets、me、settings、support、orders。Artifact 实际上传 **80 个 PNG**，说明不是 11×8 全部成功；/home 测试在 heading 断言处失败，其他页面截图上传情况须以 artifact 文件清单为准。

Artifact：
- [btcbox-responsive-visual-qa ZIP（Artifact ID 13804199963）](https://github.com/aesthetikalasers-ai/btcbox/actions/runs/42905110305/artifacts/13804199963)
- [对应 Actions 运行](https://github.com/aesthetikalasers-ai/btcbox/actions/runs/42905110305)

文件命名规则：`<route-slug>-<width>.png`，例如 `markets-320.png`、`trade-BTCUSDT-1440.png`、`trade-hub-768.png`。当前 Artifact 下载文件名没有逐一展开确认，故这里仅记录 CI 代码约定及 80 文件总数，不将未核实文件名伪装成实际清单。截图来自 CI Chromium + API mock，不是真实设备，也不是 Production 页面。

### 5.2 按页面族的布局证据

| 页面族/路径 | 桌面 | 手机 | 平板 | 独立页面组合/当前结构 | 现有截图覆盖 |
|---|---|---|---|---|---|
| Home `/home` | Dashboard 组件 | 共享 AppLayout + CSS | 共享 AppLayout + CSS | React 页面组件；当前 visual QA heading 失败 | 声明 8 宽度；本页截图未确认/预计未产出 |
| Markets `/markets` | 市场表格/筛选 | 共享页面 + CSS | 共享页面 + CSS | 未证明独立 Tablet 组合 | 320/360/375/390/430/768/1024/1440 声明覆盖；截图清单待下载确认 |
| Trade Hub `/trade-hub` | 入口卡片 | 已有 2×2 四入口卡片布局 | 共享页面响应式 | 页面组合存在，但仍需确认独立平板设计 | 同上 |
| Spot `/trade/:symbol` | 四区交易终端 | 盘口左、下单右，K 线抽屉；需保护 | 仍处 <1280px 紧凑布局 | 有实质移动布局，但复用同一页面组件/CSS | visual QA 有 8 宽度声明；另有交易专用测试宽度 320/360/375/390/393/414/430/768/1440 |
| Contract `/contract` | 桌面多列布局 | 标签切换下单/盘口/持仓订单，K 线抽屉 | 768px 起进入桌面网格的现有规则待核验 | 有独立移动内容组合迹象；平板边界未验收 | 不在 11 路径视觉截图列表 |
| Seconds `/seconds` | 未覆盖 | 未覆盖 | 未覆盖 | 源码路由存在；布局未审计 | 无 |
| Assets `/assets` | AssetsPage | 共享页面 + CSS | 共享页面 + CSS | 无独立移动 Shell 证据 | visual QA 8 宽度声明 |
| Deposit `/deposit` | 未覆盖 | 未覆盖 | 未覆盖 | Pages.tsx 页面组件；未审计布局 | 无 |
| Withdraw `/withdraw` | 未覆盖 | 未覆盖 | 未覆盖 | Pages.tsx 页面组件；未审计布局 | 无 |
| Earn `/earn` | 未覆盖 | 未覆盖 | 未覆盖 | Pages.tsx 页面组件；未审计布局 | 无 |
| Orders `/orders` | OrdersPage | 共享页面 + CSS | 共享页面 + CSS | 无独立移动组合证据 | visual QA 8 宽度声明 |
| My `/me` | MyPage | 共享页面 + CSS | 共享页面 + CSS | 无独立移动组合证据 | visual QA 8 宽度声明 |
| Settings `/settings` | AccountSecurityPage | 共享页面 + CSS | 共享页面 + CSS | 无独立移动组合证据 | visual QA 8 宽度声明 |
| KYC `/kyc` | 未覆盖 | 未覆盖 | 未覆盖 | Pages.tsx 页面组件；未审计布局 | 无 |
| Support `/support` | SupportPage | 共享页面 + CSS | 共享页面 + CSS | 无独立移动组合证据 | visual QA 8 宽度声明 |
| Login/Register | AuthPage 独立认证布局 | AuthPage 独立认证布局 | AuthPage 独立认证布局 | 不渲染 AppLayout；是否有独立 Tablet 排版未验 | visual QA 8 宽度声明 |
| Account Setup/Auth callback | 未覆盖 | 未覆盖 | 未覆盖 | 独立认证布局；页面内容未审计 | 无 |
| Admin `/admin` | AdminPage 独立路由 | 未覆盖 | 未覆盖 | 不经 AppLayout；强制 zh-CN | 无 |
| OAuth consent | 静态 HTML | CSS media query 有 420px 按钮方向规则 | 同一静态页面 | 独立静态兼容页面 | 无 |

### 5.3 指定视口逐项状态

| 类别 | 宽度 | 当前证据状态 |
|---|---:|---|
| 手机 | 320 | CI 视觉矩阵声明；截图文件需核验 |
| 手机 | 360 | CI 视觉矩阵声明；截图文件需核验 |
| 手机 | 375 | 视觉矩阵未声明；现货专用测试声明 |
| 手机 | 390 | CI 视觉矩阵声明；截图文件需核验 |
| 手机 | 430 | CI 视觉矩阵声明；截图文件需核验 |
| 平板 | 600 | 未覆盖 |
| 平板 | 768 | CI 视觉矩阵声明；截图文件需核验 |
| 平板 | 820 | 未覆盖 |
| 平板 | 1024 | CI 视觉矩阵声明；截图文件需核验 |
| 桌面 | 1280 | 未覆盖 |
| 桌面 | 1366 | 未覆盖 |
| 桌面 | 1440 | CI 视觉矩阵声明；截图文件需核验 |
| 桌面 | 1600 | 未覆盖 |
| 桌面 | 1920 | 未覆盖 |

因此现有截图测试不能支持“全站手机/平板/桌面适配已完成”的结论。它只是一组 mocked CI 浏览器检查；多数页面仍是共享 React Shell 与 CSS 断点，并无全站独立 Tablet Shell 证据。用户锁定的现货移动布局仍需优先保护。

## 6. Vercel 生产部署映射补证

本轮 Vercel 连接器只有一个可用账号授权（Vercel link 对应的可用 profile 为 `aesthetikalasers@gmail.com`）；另一个已保存连接标识返回 `link_id must identify an eligible linked account`。因此只读确认了可访问的项目，不对第二个 Vercel 账号作推断。

### 6.1 可访问项目记录

- 项目名：`btcboxcdt`
- Project ID：`prj_InHUgyajw4eUMsb9KOdjUmMF0aIP`
- Team ID：`team_AZiXGACBy90fpgeKEUb9i2YQ`
- Vercel project inspector：[项目/部署控制台](https://vercel.com/fuyao999/btcboxcdt)
- 生产域名列表返回：`btcboxcdt-pi.vercel.app`，verified=true，projectId 与上方一致。
- Project detail 的域名别名也包含 `btcboxcdt-pi.vercel.app`。
- Project detail 暴露 nodeVersion `22.x`、SSO protection enabled（all_except_custom_domains）；没有在本轮返回 Git integration 配置中的 productionBranch 字段，因此“项目设置里的生产分支”仍未独立核实。

### 6.2 Production 与 Preview 分离

| Target | Deployment ID | 状态 | Git branch / commit | 时间（Vercel 返回 Unix ms） | URL/记录 |
|---|---|---|---|---:|---|
| Production | `dpl_E8WqAXhkZENy3QKETeCAkPhWyoCK` | READY | `main` / `d89d9363cab056cca27492a721b5922c2a29d05c` | created 1794338415753；ready 1794338438430 | [Inspector](https://vercel.com/fuyao999/btcboxcdt/E8WqAXhkZENy3QKETeCAkPhWyoCK) |
| Preview（target=null） | `dpl_BwPjeSaM5PUYKr34hf4jnoidCGtr` | READY | `docs/platform-maturity-roadmap` / `c840410eb1059f47b6351e93352cf8f3e1007f85` | created 1794346605931；ready 1794346634704 | [Inspector](https://vercel.com/fuyao999/btcboxcdt/BwPjeSaM5PUYKr34hf4jnoidCGtr) |

Production deployment 的 `alias` 明确包含 `btcboxcdt-pi.vercel.app`；这是 Vercel 记录证明的项目域名绑定及部署 alias。故在本轮查询时，用户一直使用的 `btcboxcdt-pi.vercel.app` 指向上述项目的 Production deployment，commit 为 `d89d9363...`，不是路线图 Preview。

**重要新发现：** 路线图分支 `c840410...` 有 READY Preview，但 `target=null`，未被标记为 Production；不能把它当成生产版本。当前可访问项目的生产部署仍落后于仓库基线 `525cc9d6...`（Production 是 `d89d9363...`）。

### 6.3 未完成项

- 另一 Vercel 账号的同名项目 `prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`：本轮连接器返回 Project not found，未能独立验证账号归属、Git repo、域名和部署；此前报告中该项目的资料仅作为历史线索，不当作本轮证据。
- Vercel project 设置中的 configured production branch、Git repository connection 详细字段：本轮工具返回未包含这些字段，仍待补。
- DNS 公共解析链、用户浏览器实际命中的 deployment：本轮只验证 Vercel 项目域名/alias 记录，未进行独立 DNS/HTTP 请求。
- 未修改任何项目、域名、Production branch 或部署。

## 7. no-secrets 扫描状态

<badge>未完成</badge>

本轮执行环境检查：
- `gitleaks`：未安装
- `trufflehog`：未安装
- `detect-secrets`：未安装
- 工作容器无法解析/访问 github.com，`git clone --depth=1` 失败（DNS resolution failure）。
- GitHub 文件读取连接器不提供对完整 Git tracked blob 集合的本地扫描能力；因此不能声称已对仓库全部 tracked files 运行 secret scanner。

**结果：** no-secrets 扫描未执行；无 scanner 名称/版本、扫描范围、排除规则、退出码或 clean 结果。不得把既有文件扩展名检查当作替代。建议在有仓库只读 checkout 的安全 CI runner 中执行固定版本 Gitleaks 或 TruffleHog，对所有 tracked refs/当前基线扫描，并只保留不含秘密值的摘要。

## 8. 后续补证清单（交由 AI 2 独立复核）

1. 下载并逐项展开 Artifact 13804199963 的 80 个截图，建立实际文件清单；补足指定 600/820/1280/1366/1600/1920px 视口。
2. 用真实浏览器 DOM/可访问性树和截图验证 1440/1024/390 语言入口数量；再由 AI 2 审核最小修复方案。
3. 对 33 个失败逐项关联原始错误上下文、测试 fixture 和对应组件；本报告已列出 17 个独立测试名称及主要失败表现，但产品缺陷 vs 过时测试断言仍有未决项。
4. 完成所有实际发布页面的布局矩阵，尤其 Seconds、Contract、Deposit、Withdraw、Earn、KYC、Account Setup、Admin、OAuth。
5. 取得第二 Vercel 账号授权后，复核第二个同名项目；补齐 Git 连接与 production branch 配置字段。
6. 通过可用安全 runner 运行专用 secret scanner，并保存脱敏摘要。
7. 由 AI 2 对过程证据、范围合规、修复前后证据独立复核；AI 1 不自行宣布 Phase 0 通过。

## 9. 本轮结论

**Phase 0：待补证 / NOT PASSED。**

已补充：完整 React 路由及 Vercel rewrite/SPA/OAuth/API 入口分类、桌面语言菜单重复组件的源码证据、Frontend CI 原始日志统计与 17 项独立失败用例、截图矩阵声明与缺口、一个可访问 Vercel 项目的 Production/Preview 映射。

未完成：真实视口 DOM/截图、完整截图文件清单、失败逐项最终归因、全页面与全部指定视口矩阵、第二 Vercel 账号核验、专用 no-secrets 扫描。

没有改动交易页布局或生产环境，没有合并和部署。请 AI 2 继续独立审查本报告并决定下一步验收状态。


---

# 10. AI 1 下一轮 Phase 0 补证（2026-11-11）

本节补充并在证据冲突时优先于上文相应的“待下载/待授权”描述。没有修改应用源码、交易业务或 Vercel 配置。

## 10.1 Artifact 13804199963：ZIP 实际清单核验

已通过 GitHub Actions Artifact 下载接口下载 ZIP，并在本轮执行环境实际展开。ZIP SHA-256（来自 GitHub 上传日志）：`debb191d9f260698c56507ad0998fe44a8ba4b1bc0d8143d1e884a34795f2e58`；ZIP 解压后 80 个 PNG 全部存在，逐个用图像读取器核对图片宽度，图片宽度与文件名中的宽度一致。

- Artifact 文件名：`btcbox-visual-qa-13804199963.zip`
- 实际 PNG：80
- 页面 slug：10
- 每页视口：320、360、375、390、430、768、1024、1440
- 图片尺寸：每张图的 width 与后缀数字相同；未发现宽度不匹配文件。
- Artifact 原始链接：https://github.com/aesthetikalasers-ai/btcbox/actions/runs/42905110305/artifacts/13804199963
- CI job 原始日志：job ID `130140950103`，https://github.com/aesthetikalasers-ai/btcbox/actions/runs/42905110305

**实际文件清单（文件名均来自 ZIP 中央目录，而非测试代码推断）：**

| 页面 slug / 路由 | 实际存在的 PNG |
|---|---|
| assets / `/assets` | `assets-320.png`, `assets-360.png`, `assets-375.png`, `assets-390.png`, `assets-430.png`, `assets-768.png`, `assets-1024.png`, `assets-1440.png` |
| login / `/login` | `login-320.png`, `login-360.png`, `login-375.png`, `login-390.png`, `login-430.png`, `login-768.png`, `login-1024.png`, `login-1440.png` |
| markets / `/markets` | `markets-320.png`, `markets-360.png`, `markets-375.png`, `markets-390.png`, `markets-430.png`, `markets-768.png`, `markets-1024.png`, `markets-1440.png` |
| me / `/me` | `me-320.png`, `me-360.png`, `me-375.png`, `me-390.png`, `me-430.png`, `me-768.png`, `me-1024.png`, `me-1440.png` |
| orders / `/orders` | `orders-320.png`, `orders-360.png`, `orders-375.png`, `orders-390.png`, `orders-430.png`, `orders-768.png`, `orders-1024.png`, `orders-1440.png` |
| register / `/register` | `register-320.png`, `register-360.png`, `register-375.png`, `register-390.png`, `register-430.png`, `register-768.png`, `register-1024.png`, `register-1440.png` |
| settings / `/settings` | `settings-320.png`, `settings-360.png`, `settings-375.png`, `settings-390.png`, `settings-430.png`, `settings-768.png`, `settings-1024.png`, `settings-1440.png` |
| support / `/support` | `support-320.png`, `support-360.png`, `support-375.png`, `support-390.png`, `support-430.png`, `support-768.png`, `support-1024.png`, `support-1440.png` |
| trade-BTCUSDT / `/trade/BTCUSDT` | `trade-BTCUSDT-320.png`, `trade-BTCUSDT-360.png`, `trade-BTCUSDT-375.png`, `trade-BTCUSDT-390.png`, `trade-BTCUSDT-430.png`, `trade-BTCUSDT-768.png`, `trade-BTCUSDT-1024.png`, `trade-BTCUSDT-1440.png` |
| trade-hub / `/trade-hub` | `trade-hub-320.png`, `trade-hub-360.png`, `trade-hub-375.png`, `trade-hub-390.png`, `trade-hub-430.png`, `trade-hub-768.png`, `trade-hub-1024.png`, `trade-hub-1440.png` |

**失败/缺失/未生成标记：**
- `/home`：测试代码在标题 `Market overview` 的可见性断言处失败；Artifact 中不存在 `home-*.png`，8 个视口均无 PNG。
- `/seconds`、`/contract`、`/deposit`、`/withdraw`、`/earn`、`/kyc`、`/account-setup`、`/admin`、`/oauth/consent`：本 Artifact 未声明/未生成这些路径的截图，不能据此评估页面外观。
- 其余 10 个 slug 的 80 张 PNG 已确认存在；文件存在不等于页面通过了所有交互/可访问性断言。

CI 测试定义来源：`frontend/e2e/responsive-visual-qa.spec.ts`。它声明 11 条路由 × 8 个宽度，但 `/home` 标题断言先失败，实际 artifact 为 10 × 8 = 80。测试声明的 11 × 8 不应被写成 88 张实际截图。

## 10.2 真实浏览器任务：当前证据边界与最小修复建议

本轮已检查当前连接浏览器标签。没有 BTCBOX 页面标签；Chat 模式浏览器接口只提供读取已有标签及其页面文本，不提供本轮所需的导航、viewport 设置、点击、截图、DOM 脚本执行或可访问性树导出能力。当前没有可用的 Work 浏览器控制/交接工具。因此本节**不声称已完成** 1440/1024/390 实时浏览器验证，也不以 CI mock 截图冒充用户真实浏览器证据。

源码复核（基线 `525cc9d6...`）：
- `frontend/src/components/layout/AppLayout.tsx`：桌面 Sidebar 在 `min-width:1024px` 显示；移动 Dialog 内另挂一个 Sidebar；Topbar 同时挂载。
- `frontend/src/components/layout/Sidebar.tsx`：Sidebar 内无条件渲染 `LanguageMenu variant="drawer"`。
- `frontend/src/components/layout/Topbar.tsx`：Topbar 无条件渲染默认 `LanguageMenu`。
- 这能证明桌面布局树有 Sidebar + Topbar 两个菜单组件实例；不能证明两个入口均可见、实际触发器数量、关闭移动 Dialog 的可访问性行为，亦不能代替浏览器截图。
- 390px 初始状态下移动 Sidebar 位于关闭的 Dialog 中；它的 DOM 是否挂载、是否从 accessibility tree 排除，需实时 DOM/AX tree 核实，不能仅凭 JSX 推断。

**最小修复建议（未执行、未改源码）：**
1. 保留 Topbar 的默认语言入口。
2. Sidebar 增加明确的呈现上下文/variant 参数：桌面常驻 Sidebar 不渲染 drawer 语言菜单；移动 Dialog Sidebar 才渲染 drawer 菜单。
3. 不用 CSS 仅隐藏视觉元素来解决重复 DOM；让不应出现的组件实例不挂载，避免重复可聚焦/可访问入口。
4. 以 1440px、1024px、390px 实测：DOM 组件实例数、可见触发器数、role/name、AX tree；分别验证桌面入口打开/关闭、移动抽屉打开后入口打开/关闭、选择语言后 `html[lang]` 与持久化值更新。需覆盖 Escape、切换路由、抽屉关闭后焦点恢复。
5. 交由 AI 2 审核方案后再决定是否进入修复；本轮没有修改语言菜单源码。

## 10.3 CI 失败证据：原始日志与 mock 证据补充

本轮重新下载了完整 job log（285,258 字符），并确认：
- checkout SHA：`525cc9d6c72140f3778ae295e46f1338482189cc`
- Node：22.23.4；npm：10.9.9；Ubuntu 26.04.1；Chromium 安装成功。
- 安装、i18n 检查、TypeScript lint、Decimal tests、Vite build 均通过；Vite CSS 优化阶段有一条 `var(--color-brand-surface-2/70)` 的 Unexpected token Delim('/') 警告。
- 第 10 步浏览器 smoke tests 失败；最终 142 passed、33 failed、11 skipped；Artifact 上传步骤成功，实际上传 80 个文件。
- 原始失败上下文在 job log 中包含 Playwright locator、expected/timeout、源码行及每个失败用例的 Error Context 文件路径；CI 没有把完整 `test-results`、trace.zip 和失败截图包含在 Artifact 13804199963（该 Artifact 只上传 `test-results/visual-qa/*.png`）。

已核对的 fixture/mock 源码：
- `frontend/e2e/auth-routes.spec.ts`：将 `/api/auth-client-config` mock 到 `https://btcbox-e2e.invalid`，`/api/account` 固定 401；拦截 fake Supabase host。
- `frontend/e2e/language-loading.spec.ts`：将 `/api/**` 置于本地 mock；语言加载测试使用 `page.locator('select').selectOption(...)` 和 `header select`，其假设是原生 select。
- `frontend/e2e/market-feed-fail-closed.spec.ts`：mock `/api/market`、`/api/kline`；行情 fixture 包含 `markets` 数组及 `data[symbol].ts`；另测 503、超时、过期快照和 pair link。
- `frontend/e2e/navigation-accessibility.spec.ts`：先设 390×844，再点击移动导航、进入 Markets、重新打开后调整到 1440×900；随后断言移动 dialog 关闭及语言控件为原生 combobox。
- `frontend/e2e/redesign.spec.ts`：mock `/api/market`、`/api/market/pairs`、`/api/kline`、`/api/depth`、`/api/trading/status`、`/api/orders` 等；fixture 提供 BTC/ETH pair 与 synthetic market data。

重点失败的原始断言线索：
- 语言菜单：`language-loading.spec.ts` 使用原生 `selectOption`；失败日志中出现 `locator('header select')`、期望值 `de`。当前源码的 Topbar/Sidebar 使用自定义 `LanguageMenu` 组件；“断言过时/语义契约不匹配”是强候选，但需拿实际 DOM/组件源码与交互回归闭环后才可定类。
- 行情 fail-closed：测试明确 mock `/api/market` 的超时、503、过期 timestamp；日志包含 `Market feed unavailable`、报价消失及恢复等失败断言。测试 fixture 与产品请求契约尚未完整对照，因此维持“未确定”，不能推断为产品缺陷或环境问题。
- 市场交易对跳转：测试 fixture 与断言使用 BTC/ETH、`/trade/ETHUSDT`、可访问名称 `BTC spot trading`；日志出现链接 accessible name 与预期不匹配。可能是可访问名称或页面 DOM 契约差异，仍需真实 DOM/路由结果。
- 导航 resize：测试在移动 Dialog 打开状态改到 1440px，随后断言 Dialog 不可见；`AppLayout.tsx` 有 `matchMedia('(min-width:1024px)')` change handler 关闭状态。该代码支持预期关闭机制，但失败日志仍需结合完整 trace/AX tree 判定是时序、Dialog DOM 还是焦点/控件 locator 问题。
- 认证恢复：测试断言配置不可用时出现固定英文 session restoration 文案；fixture 把 `/api/**` 设为 503。尚未证明生产恢复逻辑有缺陷，需将错误状态与组件实际文案/条件对照。
- 17 个独立测试的原始测试名称、主要失败断言及桌面/移动重复关系仍以本报告第 4 节为准。**逐项最终分类仍未闭环**；无证据的项目保留未确定。建议从 CI job 重新执行时额外保存 Playwright blob report、trace.zip、error-context.md、失败截图和 mock request journal，避免只保留 visual QA PNG。

## 10.4 Vercel 双账号只读核验更新

本轮两组已连接账号授权均可读，不再适用第 6 节“第二账号无有效授权”的旧状态。

| 字段 | 新号账号 | BOX 账号 |
|---|---|---|
| Project | `btcboxcdt` | `btcboxcdt` |
| Project ID | `prj_InHUgyajw4eUMsb9KOdjUmMF0aIP` | `prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK` |
| Team ID | `team_AZiXGACBy90fpgeKEUb9i2YQ` | `team_tnwJkMYPnWK2BjBGf3Q2n3FB` |
| Project domain list | `btcboxcdt-pi.vercel.app`, `btcboxcdt-fuyao999.vercel.app`, `btcboxcdt-git-main-fuyao999.vercel.app` | `btcboxcdt.vercel.app`, `btcboxcdt-box-2753.vercel.app` |
| 已核实主域名 | `btcboxcdt-pi.vercel.app`，verified=true | `btcboxcdt.vercel.app`，verified=true |
| Production deployment | `dpl_E8WqAXhkZENy3QKETeCAkPhWyoCK` | `dpl_32SerPKNdcAtJu4iLqqYR8s4AVoP` |
| 状态 / target | READY / production | READY / production |
| commit branch / SHA | `main` / `d89d9363cab056cca27492a721b5922c2a29d05c` | `main` / `525cc9d6c72140f3778ae295e46f1338482189cc` |
| deployment source | `git` | `cli` |
| createdAt (UTC) | 2026-11-10T20:40:15.753Z | 2026-11-10T22:48:30.312Z |
| ready (UTC) | 2026-11-10T20:40:38.430Z | 2026-11-10T22:49:09.311Z |

Inspector links：
- 新号项目：https://vercel.com/fuyao999/btcboxcdt
- BOX 项目：https://vercel.com/box-2753/btcboxcdt
- 新号 Production：https://vercel.com/fuyao999/btcboxcdt/E8WqAXhkZENy3QKETeCAkPhWyoCK
- BOX Production：https://vercel.com/box-2753/btcboxcdt/32SerPKNdcAtJu4iLqqYR8s4AVoP

部署元数据的 Git source details 均记录 `githubOrg=aesthetikalasers-ai`、`githubRepo=btcbox`、branch `main`。但 BOX 项目这条 Production deployment 的 `source=cli`，所以只能证明 CLI 部署元数据引用了该 GitHub repo/commit，**不能据此声称已启用 Vercel Git 自动部署集成**。两个项目设置接口均未暴露 configured production branch 字段；Production deployment 的 branch 为 main，不等同于独立读取了该配置。未修改项目配置、域名或部署。

## 10.5 Secret scan 状态（仍未完成）

本轮没有在完整、只读的 Git checkout runner 上执行 Gitleaks 或 TruffleHog。当前工作容器不能从 GitHub 取得完整 checkout；此前 gitleaks/trufflehog/detect-secrets 均未安装。虽然下载了 CI logs 与 screenshot Artifact，但这些不构成 tracked-file scan。没有 scanner 版本、扫描范围、排除规则、退出码或 clean 结果，因此**不得声称 secret scan 通过**。需要有权读取仓库的安全 runner 执行固定版本扫描，并仅提交不含 secret 值的脱敏摘要。

## 10.6 本轮剩余未解决事项

1. **真实浏览器**：1440、1024、390 的 screenshot、DOM、AX tree、菜单打开/关闭、语言切换仍未测试；当前浏览器工具在 Chat 模式不支持导航/交互/截图，需可用 Work 浏览器控制能力。
2. **补充视口**：600、820、1280、1366、1600、1920px 尚未生成截图；本轮不修改 CI workflow 或启动新的 CI。
3. **完整页面矩阵**：指定的 Seconds、Contract、Deposit、Withdraw、Earn、KYC、Account Setup、Admin、OAuth consent 仍无真实 viewport/组件交互证据；代码路由存在不等于页面审计完成。
4. **17 个 CI 用例**：已有完整 job log 和多份 mock 测试源码，但仍需每项的完整 Error Context/trace、DOM 行为和源码逻辑对照；归因保持未确定，不能强制分类。
5. **Vercel**：两项目 ID、Team、域名和最新 Production deployment 已补齐；configured production branch 及 BOX 项目的自动 Git integration 仍未证实。
6. **Secret scan**：仍未执行，需安全只读 checkout runner。

## 10.7 本轮结论

**Phase 0 仍为待补证 / NOT PASSED。** 本轮完成 Artifact 的 80 张 PNG 实际清单与宽度核对；补齐双 Vercel 账号项目、域名和 Production deployment 的只读证据；重新读取完整 Frontend CI job log，并对主要失败测试的 mock fixture 源码进行对照。真实浏览器交互、补充视口、全部页面布局实测、17 项失败最终归因、Production branch 设置、专用 secret scan 仍未完成。未修改交易页、未写 main、未合并、未部署、未执行真实资金或金融写入。AI 1 不签发 PASS，请 AI 2 独立复核。
