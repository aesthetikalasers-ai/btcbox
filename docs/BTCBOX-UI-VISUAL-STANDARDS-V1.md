# BTCBOX 全站 UI 视觉设计与验收规范 V1.0

> **强制标准。** 新增页面、改动既有页面、重构、共享组件与发布检查都适用本文件。
> README 将其声明为唯一视觉验收标准；若本文件与任何旧 issue、旧交接文档、旧 PR 描述冲突，以本文件为准。

## 0. 文档地位与事实来源

- **唯一事实来源是代码**：`frontend/src/index.css` 的 `@theme` / `:root` token 与 `frontend/src/components/ui/*` 的组件契约。本文件是它们的**说明与验收清单**，不得引入代码中不存在的 token、组件或类名。
- 本文件声明的 token 值、路由、测试视口由 `npm run check:visual --prefix frontend` 自动校验；改代码不改文档、或改文档不改代码，都会让该检查失败。
- 变更流程：修改 token / 组件契约 / 验收视口时，必须在同一个 PR 内同时更新本文件并让 `check:visual` 通过。

## 1. 视觉方向（不可协商）

BTCBOX 是**机构级深色交易终端**，不是营销页。

1. **单一强调色**：emerald `#0ECB81` 只用于主操作、选中态、焦点环与"收到/盈利"语义。大面积背景、卡片底色、图表填充一律不使用强调色。
2. **克制的层级**：靠背景明度差（五级表面）+ 1px 边框 + 字重建立层次，不靠阴影堆叠、不靠彩色边框。
3. **数据诚实**：不得出现伪造的价格、余额、订单或 K 线。没有数据时显示明确的空状态，而不是 0 值或占位数字冒充真实数据（见 §7）。
4. **动效克制**：只允许"状态变化可见"级别的动效，禁止循环动画、背景动画、视差（见 §9）。
5. **禁止的视觉手法**：紫白渐变、玻璃拟态大卡片、emoji 当图标、双色渐变按钮、卡片套卡片套边框。

## 2. 颜色 token

全部定义在 `frontend/src/index.css` 的 `@theme` 内，以 Tailwind 工具类消费（`bg-brand-surface`、`text-brand-text-muted` 等）。**除 `index.css` 外禁止硬编码 hex。**

### 2.1 表面（五级）

| Token | 值 | 用途 |
| --- | --- | --- |
| `brand-bg` | `#0B0E11` | 页面底色、侧栏 |
| `brand-surface-2` | `#12161C` | 内嵌面板、输入框底、表格斑马底 |
| `brand-surface` | `#181A20` | 卡片、弹层主表面 |
| `brand-surface-hover` | `#1E2329` | 悬停态 |
| `brand-border` | `#2B3139` | 默认分隔线与边框 |
| `brand-border-strong` | `#3A424B` | 需要"可交互"暗示的边框（outline 按钮、可点击卡片） |

规则：同一张卡片内不得出现两层以上带边框的嵌套面板；分隔用 `border-brand-border/60` 而不是再加一个盒子。

### 2.2 文本（四级，含对比度约束）

| Token | 值 | 用途 |
| --- | --- | --- |
| `brand-text` | `#FFFFFF` | 标题、金额、关键值 |
| `brand-text-secondary` | `#B7BDC6` | 正文、说明段 |
| `brand-text-muted` | `#A6B0BD` | 标签、次要元信息、占位说明 |
| `brand-text-faint` | `#6B7480` | 输入占位符 |
| `brand-text-disabled` | `#474D57` | 禁用控件文字 |

> `brand-text-muted` 曾为 `#848E9C`，在 `#0B0E11` 上达不到 WCAG AA，导致表单标签难读；现已提到 `#A6B0BD`。**不得为了"看起来更淡"把它调回更暗的灰。**

### 2.3 语义色

| Token | 值 | 唯一允许的用途 |
| --- | --- | --- |
| `brand-accent` | `#0ECB81` | 主操作、选中、焦点 |
| `brand-danger` / `negative` / `loss` | `#F6465D` | 下跌、亏损、错误、危险操作 |
| `brand-success` / `positive` / `profit` | `#0ECB81` | 上涨、盈利、成功 |
| `brand-warning` | `#f0b90b` | 风险提示（仅限提示条/警示徽标） |
| `brand-info` / `brand-cyan` | `#72AEF2` | 中性信息、次级数据系列 |
| `brand-violet` | `#a78bfa` | 仅 Earn / 产品分区标识 |
| `brand-indigo` | `#818cf8` | 仅图表第二数据系列 |

规则：涨跌方向必须用 positive/negative，**不得用 accent 绿表达"上涨"**（accent 表示可操作）。状态徽标的颜色由 `frontend/src/lib/status-mapping.ts` 的 `*BadgeVariant` 决定，页面不得自行选色。


## 3. 字体与排版

字体栈（`index.css` `@theme`）：

- 正文/UI：`IBM Plex Sans` → `Inter` → `Noto Sans JP` → `Noto Sans SC` → `PingFang SC` → `Microsoft YaHei`
- 数字/代码：`JetBrains Mono`

规则：

1. **数字一律等宽 + 表格数字**。所有价格、数量、余额、盈亏必须使用 `font-mono` 并命中 `.font-mono`/`[class*="tabular-nums"]` 的 `font-variant-numeric: tabular-nums` 与 `font-feature-settings:"tnum" 1`，避免每次 tick 抖动。
2. **页面只有一个 `h1`**，用 `.type-page-title`；区块标题用 `.type-section-title`；卡片标题用 `.type-card-title` 或 `CardTitle`。禁止用 `<div>` + 自定义字号冒充标题层级。
3. **字号只能取自下表**，不得随手写 `text-[17px]` 这类中间值。需要偏离时必须在该行上方注释原因。

| 类 | 字号 | 行高 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| `.type-display` | `clamp(1.875rem,5vw,2.5rem)` | 1.08 | 750 | 首页/营销位大标题 |
| `.type-page-title` | `clamp(1.4rem,2.5vw,1.85rem)` | 1.18 | 650 | 页面 `h1`（见 §12 重复定义说明） |
| `.type-section-title` | `1.0625rem` | 1.35 | 600 | 区块标题 |
| `.type-card-title` | `1rem` | 1.4 | 650 | 卡片标题 |
| `.type-body` | `.9375rem` | 1.6 | — | 长文正文 |
| `.type-body-compact` | `.875rem` | 1.55 | — | 卡片正文、说明 |
| `.type-label` | `.8125rem` | 1.45 | 600 | 表单标签、行标签 |
| `.type-meta` | `.78125rem` | 1.45 | — | 元信息、时间、备注 |
| `.type-micro` | `.71875rem` | 1.4 | — | 徽标内文字、极次要信息 |
| `.type-price` | `clamp(1.375rem,4vw,1.875rem)` | 1.15 | 600 | 报价主数字 |

4. **金额主数字**（兑换、充值、下单面板）：移动端 24px、`≥640px` 30px，等宽；不得低于 20px，也不得靠单点值（如 `text-[26px]`）在 320px 宽度下撑破容器。
5. 移动端全局把 `input/select/textarea` 强制为 `16px`（防 iOS 聚焦缩放）。**需要在输入框里显示更大的数字时，用 `text-[Npx]!` 显式覆盖并注释原因**（示例：`/convert` 的金额输入）。

## 4. 布局、容器与间距

### 4.1 页面骨架

- 客户页面统一经 `PageFrame`（`frontend/src/features/pages/Pages.tsx`）：`max-w-[1520px]`、`p-3 sm:p-4 md:p-6 lg:p-8`、`gap-5`。
- 返回按钮固定为 36×36 的 `aria-label="Back"` 图标按钮，位于标题左侧；子页面必须提供返回目标。
- 资金流页面（充值/提现/兑换）加 `className="funds-flow-page"`，标题列收敛到 `max-w-3xl` 并左对齐；表单主体 `max-w-[520px]`，与标题左缘对齐。
- 交易终端是例外：全宽、锁定视口高度、独立布局系统（`.spot-terminal`），不受 `PageFrame` 约束。

### 4.2 间距与圆角

| 项 | 值 |
| --- | --- |
| 卡片内边距 | `p-4 sm:p-5 lg:p-6`（`CardHeader`/`CardContent` 已内置，覆盖时不要叠加） |
| 卡片圆角 | `rounded-xl`（12px） |
| 控件圆角 | `8px`（`--bf-radius`）；小控件 `6px`（`--bf-radius-sm`） |
| 区块间距 | `gap-4`；同组元素 `gap-2`~`gap-3` |
| 分割线 | `border-brand-border/60`，不要用双层边框 |

### 4.3 触控与安全区

- 全局 `input/select/textarea` 最小高度 44px；`<640px` 时 `button` 最小高度 44px。
- `@media (pointer: coarse)` 下：`.bf-quick-item`、`.bf-bottom-nav-item`、`.bf-tag`、`.spot-book-row`、`.bf-ticker-row` 最小高度 44px。**平板按指针类型判断，不按宽度判断。**
- 移动端底部导航高 `--bf-nav-h: 60px`。滚动容器必须预留：主滚动区 `pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0`；列表页如资产列表用 `pb-[calc(120px+env(safe-area-inset-bottom))]`；带底部 CTA 的终端用 `pb-[calc(132px+env(safe-area-inset-bottom))]`。**任何可滚动列表的最后一行都不能被底部导航遮住。**

## 5. 控件节奏

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--bf-control-h` | 40px | 终端输入框、选择器 |
| `--bf-quick-h` | 30px | 快捷百分比/档位胶囊 |
| `--bf-cta-h` | 44px | 主操作按钮 |
| `--bf-chart-bar-h` | 36px | 折叠 K 线栏 |
| `--bf-nav-h` | 60px | 移动端底部导航 |

同一屏内的输入框、选择器、按钮高度必须来自这张表，不得出现 38/42/46 这类"看起来差不多"的值。

## 6. 组件契约

共享组件位于 `frontend/src/components/ui/`。**页面不得复制粘贴组件内部的类名来"自建一个按钮"**，需要新变体时扩展组件。

### 6.1 Button

- `variant`：`default`（主操作，emerald 实心 + 深色文字）、`outline`、`secondary`、`ghost`、`link`、`destructive`。
- `size`：`default`（`min-h-11`）、`sm`（`min-h-10`）、`lg`（`min-h-12`）、`icon`（44×44）。
- `block` 为整行；`loading` 自动禁用并显示 `Loader2`。
- 禁用语义：主操作按钮禁用后变**中性灰**（`bg-brand-surface-2` + 禁用文字色），让"可点/不可点"一眼可辨；outline/secondary/ghost 保持半透明。
- 一屏只允许**一个** `default` 变体的主操作。

### 6.2 Badge

`default` / `secondary` / `destructive` / `success` / `warning` / `info` / `outline`。业务状态必须经 `frontend/src/lib/status-mapping.ts` 的 `normalize*Status` + `*BadgeVariant` + `*Label` 三件套渲染，**禁止直接显示后端返回的原始状态字符串**（后端可能返回中文"持有中"）。

### 6.3 Card

`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`，内边距已内置（见 §4.2）。卡片默认 `rounded-xl border-brand-border bg-card shadow-sm`；需要强调时才加顶部 1px accent 渐隐线（`/convert`、资产总览卡），不要给整张卡加彩色边框。

### 6.4 Input / Select / EmptyState

- `Input`：`variant` `default|outline|secondary`，`size` `default|sm|lg`。
- `Select`：原生 `<select>` + `.field-control`。`.field-control` 自带边框、背景、40px 高度、焦点环与禁用态；`select.field-control` 由 CSS 绘制右侧箭头，因此**调用方不要再额外放箭头**，左右内边距请用 `pl-*`（不要用 `px-*`，否则会把箭头需要的右侧留白覆盖掉）。
- `EmptyState`：`icon` + `title` + 可选 `hint` + 可选 `action`，样式来自 `.empty-state*`（`@layer components`，无边框，避免在已有边框的面板里套第二层框）。

### 6.5 TokenIcon

资产图标统一走 `TokenIcon`：按 symbol 解析 `cryptocurrency-icons` 的彩色 SVG，缺失时回退为确定性色相的单字母圆盘。**禁止 `<img src="https://...">` 直连外部 CDN**，也禁止用 emoji 代替币种图标。

### 6.6 焦点与键盘

- 全局 `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`，不得 `outline: none` 后不给替代环。
- 用 `focus-within` 给"图标 + 原生 select"这类组合控件加环（示例：`/convert` 的资产选择器）。
- 图标按钮必须有 `aria-label`；纯装饰图标必须 `aria-hidden="true"`。

## 7. 状态与反馈

每个数据区块必须实现四态，且四态都有**可读文案 + ARIA 语义 + 恢复动作**：

| 态 | 要求 |
| --- | --- |
| loading | 骨架屏（`animate-pulse` 的 `bg-brand-surface-2` 块）占位，`role="status"`；不要用全屏 spinner 盖住已有内容 |
| empty | 明确说明"当前没有数据"及下一步，禁止用 0 或假数据填充 |
| error | `role="alert"` + 具体原因 + 重试入口；不得只显示"出错了" |
| success | `role="status"`，并在数据刷新后自动消失或随下一次操作清除 |

金融写操作额外要求三态：**未提交 / 提交中 / 结果未确认**。结果未确认时必须提示"刷新余额与记录后再重试"，不得静默重试或乐观更新余额。

服务端错误码必须映射到已上线文案（示例：`CONVERSION_FAILURE_KEYS`），不得把后端英文/中文原句直接抛给用户，也不得把所有失败压成一句泛化提示。

## 8. 文案与国际化

1. **支持语言**：`en`、`ja`、`zh-CN`、`es`、`pt`、`it`、`de`（另有保留的 `vi` 词典）。文件位于 `frontend/src/lib/locales/*.json`。
2. **首访默认 `ja`**，用户手动选择后写入 `localStorage["btcbox-language"]`；`en`/`ja`/`zh-CN` 随主包加载，其余语言按需 `fetch`。
3. **所有可见文案必须经 `t()`**。新增 key 必须同时写入 8 个词典，否则 `check:i18n` 失败。
4. `loading-messages.json` 的 `Loading…`、`Unable to load this language. Please try again.`、`Try again` 三键必须与各词典一致。
5. **数字格式化统一用 `formatDecimalAmount(value, localeTags[language])`**，不要用 `toFixed` 或手写千分位。
6. 通过变量传入 `t()` 的字符串（例如 `t(item.title)`）静态扫描抓不到，**新增这类 key 时必须手动确认它在 `en.json` 中存在**。
7. 文案本身要诚实：不承诺未实现的能力，不把内部运营流程写进用户页面（见已修正的 `/transparency`）。

## 9. 动效

| 场景 | 时长 | 曲线 |
| --- | --- | --- |
| 颜色/边框/背景过渡 | 150ms | `ease` |
| 价格 tick 回落 | 340ms | `cubic-bezier(.2,.7,.3,1)` |
| 价格闪烁（涨/跌底色） | 620ms | `ease-out` |
| 路由/抽屉进出 | ≤ 220ms | `ease-out` |

规则：

- 只允许"状态变化可见"级别：tick、闪烁、抽屉、焦点。**禁止循环动画、背景动画、视差、自动轮播。**
- 价格变化不得整段换色（会形成频闪），只允许 2px 位移 + 淡出。
- `prefers-reduced-motion: reduce` 下所有 animation/transition 必须降到 `0.01ms`（已在 `index.css` 全局处理，新增动画不得绕过）。
- 进度/倒计时类动效（如报价有效期）每秒更新一次即可，不要用 requestAnimationFrame 做高频重绘。

## 10. 验收分层（四层全部必过）

每一层都是**独立**的，不允许"桌面缩小即移动端"。

| 层 | 内容 | 视口 |
| --- | --- | --- |
| L1 全站一致性 | token、字号、组件变体、状态四态、i18n key 完整 | 1440×900 |
| L2 移动端独立验收 | 独立布局、触控 ≥44px、底部导航不被遮挡、无横向溢出 | 320、360、375、390、414、430、600 |
| L3 桌面端独立验收 | 栅格、留白、信息密度、hover/focus | 768、1024、1279、1280、1366、1440、1920 |
| L4 连续响应式 | 28 个宽度 320→1920 逐档检查，无断点跳变、无布局断裂 | 320、360、375、390、414、430、480、540、600、680、767、768、820、860、899、900、960、1023、1024、1100、1180、1279、1280、1366、1440、1536、1680、1920 |

### 10.1 执行命令

```sh
npm install --prefix frontend
npm run lint --prefix frontend            # tsc --noEmit
npm run build --prefix frontend           # tsc -b && vite build
npm run check:i18n --prefix frontend      # 词典覆盖 + t() key 校验
npm run check:visual --prefix frontend    # 本文件的 token/路由/视口一致性
npm run test:e2e --prefix frontend        # Playwright：L1–L4
```

单路由复核（避免全量耗时）：

```sh
npm run test:e2e --prefix frontend -- -g "responsive visual QA /convert at V1.0 widths"
npm run test:e2e --prefix frontend -- -g "continuous responsive sweep /convert"
```

### 10.2 证据要求

- 每个改动页面至少提交 **L2 + L3 各一张截图**（320 或 390，以及 1440）。
- 新增/修改页面必须登记进 §11；`responsive-visual-qa.spec.ts` 的 `routes` 扫过的路径必须全部能在 §11 找到（参数化行如 `/trade/:symbol` 覆盖 `/trade/BTCUSDT`），否则 `check:visual` 失败。
- 判定：四层全部通过且有证据 = 可发布；任一层缺失 = 未完成，不得称"视觉完成"。

## 11. 路由覆盖矩阵

`P` = 需要登录（`ProtectedAccountRoute`）。新增页面必须在此表登记，否则 `check:visual` 失败。

| 路由 | 页面 | 认证 | 备注 |
| --- | --- | --- | --- |
| `/home` | Dashboard | — | `tone-home` |
| `/markets` | 行情 | — | `tone-market` |
| `/trade` | 交易重定向 | — | 跳转到默认交易对，无独立页面 |
| `/trade/:symbol` | 现货终端 | — | 全宽锁定视口，不受 `PageFrame` 约束 |
| `/mobile-terminal` | 移动交易终端 | — | 独立全屏布局 |
| `/trade-hub` | 交易入口 | — | |
| `/chart/:symbol` | K 线 | — | |
| `/seconds` | 秒合约 | — | |
| `/assets` | 资产 | P | 总览卡 + 列表，移动端底部留 120px |
| `/funds` | 资金入口 | P | |
| `/me` | 我的账户 | — | 未登录展示登录卡 |
| `/orders` | 订单 | P | 游标分页 |
| `/deposit` | 充值 | P | 资金流布局 |
| `/withdraw` | 提现 | P | 资金流布局 |
| `/convert` | 兑换 | P | 资金流布局，单列交换面板 |
| `/address-book` | 地址簿 | P | |
| `/fund-password` | 资金密码 | P | |
| `/earn` | Earn | — | |
| `/contract` | 永续合约 | — | 独立布局 |
| `/kyc` | 身份验证 | P | |
| `/support` | 客服 | — | |
| `/rewards` | 邀请返佣 | — | |
| `/new-listings` | 新币上线 | — | |
| `/settings` | 安全设置 | P | |
| `/trust` | 信任中心 | — | |
| `/transparency` | 透明度 | — | 仅面向用户的规则说明 |
| `/fees` | 费率 | — | |
| `/rules` | 交易规则 | — | |
| `/risk` | 风险披露 | — | |
| `/security` | 安全 | — | |
| `/login` | 登录 | — | 独立页（无外壳） |
| `/register` | 注册 | — | 独立页（无外壳） |
| `/auth/react-callback` | OAuth 回调 | — | 独立页（无外壳） |
| `/account-setup` | 账户初始化重定向 | — | 跳转到 `/me` |
| `/` | 首页重定向 | — | 跳转到 `/home` |
| `/admin` | 管理后台 | P | 独立 `AdminPage`，`tone-admin` |

## 12. 已知偏差（修复前必须显式豁免）

以下问题在代码中真实存在，按本文件标准属于不合格项。改动相关页面时**不得复制这些做法**，并应优先修复：

1. **`.type-page-title` 被定义两次。** `index.css` 先在 `@layer components` 声明 `clamp(1.5rem,3.5vw,1.875rem)`，随后在另一个 `@layer components` 块又声明 `clamp(1.4rem,2.5vw,1.85rem)`；同层后者胜出，所以**当前实际生效的是 1.4–1.85rem 版本**。§3 表格按生效值填写。收敛成一处前，不要依赖第一个值。
2. **`.tone-*` 全部同色。** `tone-home`、`tone-assets`、`tone-trading` 等九个 tone 的 `--page-accent` 都是 `#21C7A8`，页面身份目前只靠标题与内容区分。新增页面不必再发明 tone。
3. **旧静态页残留类名。** `index.css` 中仍有 `.spot-terminal`、`.term-*`、`.bf-*` 等终端专用类，属于交易页独立系统；非交易页面不得复用。

> 已修复记录：`.field-control` / `.field-textarea` / `.empty-state*` 曾经被组件引用但从未定义，导致默认 `Select` 无边框、无高度、无箭头，`EmptyState` 完全无样式。现已补齐定义（见 §6.4），因此不再列为偏差。

## 13. 变更检查清单

提交 UI 改动前逐条确认（可直接作为 PR 描述模板）：

- [ ] 只使用了 §2 的 token，没有新增硬编码颜色
- [ ] 字号来自 §3，数字全部 `font-mono` + `tabular-nums`
- [ ] 新页面登记进 §11（`routes` 扫过的路径必须能在 §11 找到）
- [ ] L2（320/390）与 L3（1440）截图已附，且无横向溢出
- [ ] L4 连续响应式已跑，无断点跳变
- [ ] 四态齐全：loading / empty / error / success，且都有 ARIA 语义
- [ ] 金融写操作有"结果未确认"分支，未做乐观更新
- [ ] 新文案已写入 8 个词典，`check:i18n` 通过
- [ ] 触控目标 ≥44px，移动端底部导航未遮挡内容
- [ ] 焦点环可见，图标按钮有 `aria-label`
- [ ] `lint` / `build` / `check:i18n` / `check:visual` 全部通过
- [ ] 未引入本文件 §12 列出的已知偏差做法

