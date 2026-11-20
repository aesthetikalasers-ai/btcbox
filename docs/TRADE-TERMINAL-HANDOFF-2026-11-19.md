# 交易终端桌面端 — 工作记录（2026-11-19）

> 分支 `111222333` · 目录 `c:\Users\xinAI\btcboxcdt`
> 设计规范原文：仓库根目录 `BTCBOX-设计规范与分阶段实施规划-AI执行版.md`

## 本地运行

```bash
# 1) 行情网关
cd c:/Users/xinAI/btcboxcdt
node backend/market-server.js 8080

# 2) 前端
cd frontend
npm run dev -- --host 127.0.0.1 --port 4173
```

验证：

```bash
cd frontend
node scripts/probe-live-terminal.cjs 1920 1080 http://127.0.0.1:4173
node ./node_modules/typescript/bin/tsc --noEmit
npm run check:i18n
```

---

## 今日完成的修复

### 1. 图表与盘口空白

**原因**：`backend/market-server.js` 的 CORS 是硬编码端口白名单。Vite 端口被占用时会自动换端口（4173→4174），换端口后所有 `/api/*` 请求被浏览器拦截，K 线与盘口同时为空（顶部价格则回退成 fixture 样例数据）。另外 `/api/stream/*` SSE 通道没有挂载。

**修复**：
- `market-server.js`：CORS 接受任意 loopback origin；挂载 `/api/stream/depth` 与 `/api/stream/trades`
- `stream-core.js`：新增 `readTradesFromBinance()`，Bybit 不可达时回退 Binance `aggTrades`

### 2. 矮屏整页锁死、看不到订单记录

**原因**：`index.css` 的矮屏回退规则把容器改成 `height:auto`，但 `main` 仍是 `overflow:hidden`。终端实际高度 1527px、可视区仅 628px，且不可滚动。

**修复**：`@media (min-width:1280px) and (max-height:760px)` 中恢复 `main { overflow-y:auto }`，三栏各自 `align-self:start`，中栏盘口与成交改为固定高度。

### 3. 订单面板空间过小、中栏比例失衡

**原因**：`.term-col--main` 是 `1fr auto`，订单面板在 `auto` 行只拿 min-content 高度，被 `min-height:152px` 卡住；K 线独占剩余空间（732px）。中栏盘口与成交都是 `flex:1 1 auto`，按内容高度分配，成交挤占盘口。

**修复**：
```css
.term-col--main { grid-template-rows: minmax(0, 1fr) clamp(240px, 30%, 340px); }
.term-bottom { max-height: none; height: clamp(240px, 30%, 340px); }
.term-col--book > div:first-child { flex: 0 0 auto; height: min(58%, 520px); }
```

1080px 下：K 线 616px、订单面板 **240px**、盘口 **516px**、成交 366px，三栏 892px 完全对齐。

### 4. 交互完善（本轮）

| 项目 | 实现 |
|---|---|
| 顶部提示条 | 已有关闭 `×`；新增「查看详情」链接到 `/support`（真实说明，不承诺用户可自行解锁） |
| 未登录下单区 | 表单已全部 `disabled`；新增 `term-form-gate` 遮罩，**点击任意输入区即唤起登录弹窗**；CTA 与顶部「登录/创建账户」同样唤起弹窗（不再跳页） |
| 未登录禁用态视觉 | 整块降低不透明度至 55%，`cursor: not-allowed`，CTA 保持全亮 |
| 盘口展开 | 新增 `term-book-expand` 按钮，展开后隐藏成交区，盘口 250px → 799px（20 档） |
| 底部面板 | 新增「成交明细」Tab（`当前委托 / 订单历史 / 成交明细 / 资产`），数据来自同一 `/api/orders`，未登录显示引导文案 |

> 盘口档位切换**未加过渡动画**：规范要求高频行情数字不闪烁，换档加动画会让价格看起来在跳动。

### 5. 行情降级状态（不再用样例数据兜底）

**问题**：`api.ts` 的 `getMarkets()` 在请求失败时回退 `getSampleMarkets()`，把一套写死的样例价格（BTC 68,420.55 等）显示成实时行情。用户和开发者都无法从界面看出后端已挂。

**修复**：
- `getMarkets()` 改为**抛错**：网络异常、`ok: false`、空数组、全部行校验失败，分别抛 `ApiError`，`code` 为 `NETWORK_ERROR / MARKET_DATA_UNAVAILABLE / MARKET_DATA_EMPTY / MARKET_DATA_INVALID`。导出常量 `MARKET_UNAVAILABLE_MESSAGE` 统一文案。
- 交易终端新增 `.term-feeddown` 降级条：**红色**（与琥珀色策略提示区分）、含 `WifiOff` 图标、不可关闭（行情断了不应允许静默）、右侧「重试」按钮触发重新拉取。
- 顶部价格与 24h 高/低/量在无数据时显示 `—`，绝不显示数字。

**实测**（拦截 `/api/market` 返回 503）：

| 检查项 | 结果 |
|---|---|
| 降级条出现 | ✅ |
| 文案 | ✅ “Market data connection lost. Live prices are unavailable — please retry shortly.” |
| 顶部价格 | ✅ `—`（`priceIsPlaceholder: true`） |
| 24h 高/低/量 | ✅ `—` / `—` / `—` |
| 重试重新请求 | ✅ 请求数 3 → 4 |

### 6. 桌面交易页缺少永续 / 秒合约 / 理财入口

**问题**：`TradeProductNav`（Spot / Perpetual / Seconds / Earn）只用在紧凑布局和秒合约页，**桌面终端 `proTerminal` 分支完全没用它**。桌面终端是视口锁定并丢弃页面头部的，结果宽屏下用户没有任何入口去其它交易产品。

**修复**：
- `proTerminal` 顶部插入 `<div className="term-product-nav"><TradeProductNav leftIndent="px-1" /></div>`
- `.spot-terminal--pro` 网格行由 `auto auto minmax(0,1fr)` 改为 `auto auto auto minmax(0,1fr)`
- `.term-product-nav` 在终端内压缩为 **34px** 条：隐藏共享组件的环境光晕（`div[aria-hidden]`），缩小字号与图标，避免占用图表和下单面板的高度

**实测**：

| 检查项 | 结果 |
|---|---|
| 入口数量 | ✅ 4 个：Spot / Perpetual / Seconds / Earn |
| 当前页高亮 | ✅ Spot 带 `aria-current="page"` |
| 链接地址 | ✅ `/trade/BTCUSDT`、`/contract`、`/seconds`、`/earn` |
| 点击跳转 | ✅ Perpetual→`/contract`、Seconds→`/seconds`、Earn→`/earn` |
| 导航条高度 | ✅ 34px |
| 三栏仍对齐 | ✅ 1080/900/768 为 849/669/537，完全一致 |

### 7. 顶栏重构为专业终端单行布局

**问题**：顶栏 72px 偏高，从左到右是 Logo、搜索框以及右侧的 Markets/Trade 快捷入口、认证按钮；产品入口分散，不符合专业终端的单行高密度布局。

**重写 `src/components/layout/Topbar.tsx`**：

| 区域 | 内容 |
|---|---|
| 左 | BTCBOX Logo → `Spot / Perpetual / Seconds / Earn` 产品 Tab（当前项为绿色细下划线 + 柔和辉光） |
| 中 | 紧凑搜索框，`⌘K` 快捷键提示，`Cmd/Ctrl+K` 真实聚焦 |
| 右 | 登录（幽灵按钮）、创建账户（**绿色渐变主按钮**）、客服图标（含未读角标）、语言切换 |

- **移除** Markets / Trade 快捷入口（`/markets` 与 `/trade` 仍可从侧边栏和手机底部导航进入）
- 高度 `72px → 56px`（`--pro-header: 4.5rem → 3.5rem`），交易区因此**多出 16px**
- 玻璃质感：`backdrop-blur-xl` + `bg-brand-bg/80` + 顶部 1px 渐变高光；边框降到 `white/[0.06]`
- 全站唯一渐变仅用于「创建账户」主按钮，符合「无过度装饰」

**实测**：

| 检查项 | 结果 |
|---|---|
| 顶栏高度 | ✅ 56px（原 72px） |
| 单行 | ✅ 4 个子元素中心点全为 y=28 |
| 产品 Tab | ✅ 4 个，Spot 带 `aria-current="page"` |
| Markets/Trade 快捷入口 | ✅ 已移除（`hasMarketsShortcut: false`） |
| 搜索框 + 快捷键提示 | ✅ 可见，含 `⌘K` |
| `Ctrl/⌘+K` 聚焦搜索 | ✅ `focused: true` |
| 创建账户渐变 | ✅ `backgroundImage` 含 gradient |
| 日文下仍单行 | ✅ 56px，无横向溢出 |
| 交易区高度收益 | ✅ 849px → **865px**（1080 视口） |

### 8. 移除重复的导航与认证入口 + 未登录引导分层

**问题**（用户截图）：
1. 顶栏已有 `Spot / Perpetual / Seconds / Earn`，终端内又完整重复一遍
2. 顶栏已有登录/创建账户，行情栏右侧又出现一组
3. 未登录时灰色输入框与绿色 CTA 交织，容易误判为界面卡死

**修复**：

| 项目 | 处理 |
|---|---|
| 终端内产品导航 | 删除 `term-product-nav`，网格行 `auto auto auto minmax(0,1fr)` → `auto auto minmax(0,1fr)`，删除失效 CSS |
| 行情栏登录/注册 | 删除，仅保留「资产」「订单历史」 |
| 未登录引导 | 新增 `.term-signin-card`：圆形图标 + 标题「登录后即可交易」+ 说明 + 全宽 CTA；顶部径向柔光，与灰化输入框形成明确层级 |
| 价格闪烁 | `priceTickPulse` 由「整段变色」改为「1.5px 微升 + 淡入」(.34s)；`priceFlash` 透明度 .28 → .16、时长 .9s → .62s |

**修复过程中发现的真实缺陷**：把 CTA 移进卡片后，`.term-form .term-submit` 的 `z-index: 4` 选择器不再匹配，导致**唯一的可点击按钮被登录遮罩盖住、点击无响应**。已把 `.term-signin-card` 一并纳入提升规则，并让卡片本身也触发登录（保证“点任意位置唤起登录”）。

**实测**：

| 检查项 | 结果 |
|---|---|
| 终端内产品导航 | ✅ 不存在（`terminalProductNav: false`） |
| 顶栏产品 Tab | ✅ 4 个 |
| 行情栏右侧 | ✅ 仅 `Assets`、`Order history` |
| 引导卡片 | ✅ 标题 + 说明 + 全宽 CTA |
| 点击 CTA 唤起登录 | ✅ |
| 点击表单区唤起登录 | ✅ |
| 交易区高度 | ✅ 865px → **905px**（省下 34px 导航行） |
| 三栏对齐 | ✅ 905/725/593（1080/900/768） |

### 9. 永续 / 秒合约页同样重复了产品导航

**问题**：现货终端修好后，永续与秒合约页仍在页面内自行渲染了一套产品 Tab。

**修复**（`TradeProductNav` 只保留在全局顶栏）：

| 文件 | 改动 |
|---|---|
| `ContractPage.tsx` | 删除整条「全出血通栏」产品导航 + 未使用的 import |
| `SecondsPage.tsx` | 删除 `<TradeProductNav />` + 未使用的 import |

> 理财页（`EarnPage`）本身没有重复导航；它的「请登录」提示条是页面级引导，指向 `/login`，不冲突。
> `Pages.tsx:909` 的 `TradeProductNav` 属于 **<1280px 紧凑布局**（此时顶栏隐藏产品 Tab），必须保留。

**全站审计实测**：

| 路由 | 产品导航数 | 是否仅在顶栏 | 顶栏 Tab | 页面内重复的登录按钮 |
|---|---|---|---|---|
| `/trade/BTCUSDT` | 1 | ✅ | 4 | 0 |
| `/contract` | 1 | ✅ | 4 | 0 |
| `/earn` | 1 | ✅ | 4 | 0 |
| `/seconds` | 1 | ✅ | 4 | 0 |

### 10. 三个交易页缺少币种切换入口

**问题**：现货、永续、秒合约都只显示交易对名称，无法切换标的。

**根因（两类）**：

| 页面 | 真实原因 |
|---|---|
| 现货 | **完全没有实现**——`pairSymbols` 状态已加载但从未渲染；`pairsDrawerOpen` 定义了却从未使用（废弃代码） |
| 永续 | 选择器**存在但被禁用**：本地网关 `market-server.js` **没有实现 `/api/perpetual/markets`**（返回 404）→ `markets.length === 0` → `disabled` |
| 秒合约 | 本身正常（BTC/ETH/SOL 可点击） |

**修复**：

1. **`backend/market-server.js`**：新增 `/api/perpetual/markets`，由实时现货快照推导合约列表（标的价格即现价，不伪造），杠杆档位为配置项
2. **`Pages.tsx`**：把现货终端 `<h1>` 交易对标题改为下拉触发器，新增 `.term-pair-dialog` 选择弹层（2 列网格、当前项高亮、点击跳转 `/trade/:symbol`），仅列出后端 `enabled` 的交易对

**实测**：

| 页面 | 检查项 | 结果 |
|---|---|---|
| 现货 | 触发器可用 | ✅ `spotDisabled: false` |
| 现货 | 弹层选项 | ✅ 6 个（BTC/ETH/SOL/BNB/XRP/DOGE） |
| 现货 | 点击切换 | ✅ 选 ETH → `/trade/ETHUSDT` |
| 永续 | 弹层选项 | ✅ 6 个合约标的 |
| 秒合约 | 原生切换 | ✅ 已有 |
| `/api/perpetual/markets` | 接口 | ✅ 200，返回实时标的 |

### 11. 改为币安式常驻币种列表面板（替代居中模态框）

**反馈**：用居中弹窗切换币种不符合币安的做法——币安是**左侧常驻的市场列表**，带搜索框与实时价格/涨跌幅。

**实现**（`Pages.tsx` + `index.css`）：

- 在 `term-layout` 最左侧新增 `<aside class="term-col--pairs">` 常驻栏，宽 **172px**
- 顶部：搜索框（按币种过滤）+ 折叠按钮
- 表头：`Pair / Last price / 24h` 三列
- 每行：`BTC/USDT` + 实时价 + 涨跌幅（绿涨红跌，`tabular-nums`），当前交易对左侧绿色高亮条
- 数据源：复用 `/api/market` 全量快照（`marketList`），每 5 秒随行情刷新
- 折叠后收为 **28px** 细条，把宽度让给 K 线
- 网格改为 4 列：`172px | 图表 | 盘口+成交 | 下单`

**实测**：

| 检查项 | 结果 |
|---|---|
| 常驻栏渲染 | ✅ 宽 172px，6 行 |
| 行内容 | ✅ `BTC/USDT 62,562.07 -2.19%` |
| 当前项高亮 | ✅ `.is-active` |
| 搜索过滤 | ✅ 输入 `eth` → 6 行过滤为 **1 行**（ETH/USDT） |
| 点击切换 | ✅ → `/trade/ETHUSDT` |
| 折叠 | ✅ 172px → **28px**，K 线 891px → **981px** |
| 四栏对齐 | ✅ 905 / 905 / 905 |

### 12. 顶栏严格对齐需求规范

逐条核对原始要求后修正的偏差：

| 要求项 | 之前 | 现在 |
|---|---|---|
| 右侧主按钮文案 | `Create account` | ✅ **`Sign Up`**（8 语言包补齐） |
| 快捷键提示 | 硬编码 `⌘K` | ✅ **按平台显示**：Mac `⌘K` / Windows `Ctrl K` |
| 搜索框高度 | **44px**（被全局 `input { min-height: 44px }` 撑大） | ✅ **32px** |
| 右侧按钮高度 | 被全局 `button { min-height: 44px }` 撑大 | ✅ 28–32px |

**搜索框被撑大的根因**：`index.css:130` 有 `input:not([type=checkbox]):not([type=radio]), select { min-height: 44px }`（移动端触摸目标规范）。它在 56px 高的桌面顶栏里只留 6px 呼吸空间，视觉重心被压偏。已加作用域豁免：

```css
header.topbar input:not([type="checkbox"]):not([type="radio"]) { min-height: 0; }
header.topbar button { min-height: 0; }
```

**严格验收（1920×1080）**：

| 要求 | 实测 |
|---|---|
| 左：Logo → 产品 Tab | ✅ `leftOrder: [logo, productTabs, search, actions]` |
| 产品 Tab 4 个 | ✅ Spot / Perpetual / Seconds / Earn |
| 激活 Tab 绿色指示 | ✅ `background: rgb(14,203,129)`、`opacity: 1`、`glow: true` |
| 中：紧凑搜索 | ✅ 高度 **32px**、可见 |
| `Cmd/Ctrl+K` 提示 | ✅ `Ctrl K`（本机 Windows） |
| 右：Log In | ✅ |
| 右：Sign Up（绿色渐变） | ✅ `signUpText: "Sign Up"`、`signUpGradient: true` |
| 右：Support 图标 | ✅ `hasSvg: true`、`textLength: 0`（纯图标） |
| 右：语言切换 | ✅ |
| 玻璃拟态 | ✅ `backdrop-filter: blur(24px)`、半透明底色 |
| 精细边框 | ✅ `border-bottom: 1px` |
| 暗色主题 | ✅ |
| 单行 | ✅ 4 个子元素中心点全为 y=28 |
| 高度 | ✅ **56px**（原 72px） |
| 1280/1440/1600/1920 断点 | ✅ 全部 56px、单行、搜索框 32px |
### 13. 现货与永续的市场弹窗统一为同一个组件

**反馈**：现货和永续的「选择市场」弹窗应该是同一个组件，而非各写一套。

**实现**：

1. 新建 `frontend/src/features/trade/MarketPickerDialog.tsx` —— 统一的市场选择弹窗：
   - 统一的 `term-pair-dialog` 结构（标题、搜索框、双列网格列表）
   - 每行：`label`（BTC/USDT）+ `price`（实时价）+ `changePct`（涨跌幅，绿涨红跌）
   - `activeId` 高亮当前项；`onSelect` 回调；`emptyLabel` 空状态
   - 搜索按 label/id 过滤，关闭时自动清空
2. **现货页**（`Pages.tsx`）：内联的 `Dialog.Root` 替换为 `<MarketPickerDialog>`
3. **永续页**（`ContractPage.tsx`）：原有 `Dialog` 替换为 `<MarketPickerDialog>`，删除死代码 `symbolSearch`

**修复前差异**：现货用 `term-pair-dialog`（居中模态、无搜索、双列）；永续用底部抽屉（`fixed bottom-0`）+ 单独搜索。两套完全不同。

**修复后**：两页共享同一组件、同一套 CSS。

**实测**：

| 检查项 | 结果 |
|---|---|
| 现货弹窗 | ✅ `term-pair-dialog`，6 个交易对，点击切换正常 |
| 永续弹窗 | ✅ `term-pair-dialog`，6 个合约标的，含搜索 |
| 组件统一 | ✅ 两页都渲染 `MarketPickerDialog`，类名一致 |
| `tsc --noEmit` | ✅ 0 错误 |
| `check:i18n` | ✅ 8 语言包 100%、0 缺失、0 重复 |

### 14. 设计评审清单修复（P0/P1/P2）

按用户提供的三部分评审清单逐项核对与修复：

**P0 — 布局与空间**

| 项 | 根因 | 修复 |
|---|---|---|
| 订单簿只显示卖盘、成交只有 5 行、底部死黑留白 | 组件其实**早已是三段式**（10 卖 + 中间价 + 10 买 + 深度条），但 `.term-col--book > div:first-child { height: min(58%, 520px) }` 把盘口容器压到 520px，低于内容需要的 ~660px，`overflow-y:auto` 把买盘滚出视野 | 盘口容器改 `flex: 1 1 auto; height: auto`，成交区固定 `240px`。实测：20 行全显示、买盘可见、深度条 20/20、中间价在卖买之间 |
| 左栏过窄截断 BTC/USDT | 172px | 加到 **260px**，交易对名完整显示 |

**P1 — 交互**

| 项 | 结果 |
|---|---|
| 订单簿三段式 + 深度条 + 视图切换 | ✅ 组件本身已有（asks/mid/bids + `backgroundSize` 深度条 + 双向/买一/卖一按钮），本次修复的是**高度截断**问题 |
| 系统警告条不够醒目 | 根因：`--color-brand-warning` 被误设为灰蓝 `#A2B0BE`，导致横幅「灰绿底配浅灰字」 | 改为琥珀黄 `#f0b90b`（两个变量都改） |

**P0 多语言遗漏**

| 项 | 根因 | 修复 |
|---|---|---|
| 中文界面出现英文 `Market data stays fully available without an account.` | 该 key **在 8 个语言包中都不存在**（代码用 `t("Market data stays...")` 但字典里只有带前缀的完整句），导致回退英文原文 | 补齐 8 语言包，中文为「未登录状态下仍可查看完整实时行情数据。」 |

**P2 — 视觉规范**

| 项 | 修复 |
|---|---|
| 表单标签对比度过低 | `--color-brand-text-muted` 从 `#848E9C` 提亮到 `#A6B0BD`；faint 从 `#5E6673` → `#6B7480` |
| 价格等宽 | ✅ 已确认顶部价格/余额/输入框/盘口全部带 `tabular-nums` + `font-mono`，无需改动 |
| 右下角悬浮调试图标 | ⚠️ **代码库中未找到该元素**（无 eruda/vconsole/debug 图标），疑为浏览器扩展，需用户截图定位 |

**实测**：盘口 20 行完整、深度条 20/20、栏宽 260px、`tsc` 0 错误、i18n 8 语言包 100%、gateway 测试 9/9。

---

## 实测结果（零 mock）

| 检查项 | 结果 |
|---|---|
| 点击 CTA 唤起登录弹窗 | ✅ 弹窗标题 `Sign in` |
| 点击表单输入区唤起登录弹窗 | ✅ |
| 盘口展开 | ✅ 成交隐藏，盘口 250 → 799px，20 档 |
| 成交明细 Tab | ✅ 选中态正确，未登录显示 `Sign in to view your trade history.` |
| 三栏高度对齐 | ✅ 1080/900/768 为 889/709/577，完全一致 |
| 视口锁定（≥761px） | ✅ `scrollH === clientH`，无滚动 |
| 矮屏可滚动（≤760px） | ✅ 700px 需滚动 29px，面板可见 |
| `tsc --noEmit` | ✅ 0 错误 |
| `check:i18n` | ✅ 8 个语言包 100% 覆盖、0 缺失、0 重复 |

## 已知遗留

- `redesign.spec.ts` 有 9 个**既有** e2e 失败（`git stash` 基线对比一致），主因是断言选择器与当前实现不符，与本轮改动无关。
- `check:i18n` 仍报告约 28 个其它页面未登记的 `t()` key（如 `Est. APR`、`Hot`、`Add to favorites`），回退英文显示。

## 相关文件

新增：`frontend/src/features/trade/TerminalOrderBook.tsx`、`TerminalOrderForm.tsx`、`frontend/scripts/probe-live-terminal.cjs`

修改：`frontend/src/features/pages/Pages.tsx`、`frontend/src/index.css`、`backend/market-server.js`、`backend/stream-core.js`、`backend/stream-api.js`、`frontend/src/lib/locales/*.json`
