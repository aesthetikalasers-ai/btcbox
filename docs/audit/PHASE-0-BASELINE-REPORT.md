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
