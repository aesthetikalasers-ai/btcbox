# 交易终端 · 最终验收报告（2026-11-19）

> 验收依据：`BTCBOX-设计规范与分阶段实施规划-AI执行版.md` 第 6 节「最终验收清单」
> 验收方式：静态读码 + `tsc` / `check:i18n` 编译检查（未启动本地服务做浏览器实测）
> 结论图例：✅ 通过 · ⚠️ 部分通过/存疑 · ❌ 未通过 · 🔬 需启动服务实测才能判定

---

## 一、总览

| 分块 | 通过 | 部分/存疑 | 未通过 | 需实测 |
|---|---|---|---|---|
| 设计系统（5） | 1 | 3 | 1 | 0 |
| 交易终端（5） | 1 | 2 | 0 | 2 |
| 响应式（5） | 3 | 0 | 0 | 2 |
| 性能与业务（5） | 2 | 2 | 0 | 1 |

**结论：当前不能判定「验收通过」。存在 1 个硬性失败项（编译不通过）+ 多个需实测确认项。**

---

## 二、逐条核对明细

### A. 设计系统（5 项）

| # | 规范原文 | 核对结果 | 证据 |
|---|---|---|---|
| A1 | Logo 与品牌颜色一致，全站背景/字体/圆角/按钮/输入框统一 | ⚠️ | 颜色 Token 有**两套并存**：`src/styles/btcbox-design-tokens.css`（`--color-bg-primary:#0b0e11` 等）与 `src/index.css` 内 Tailwind/shadcn 的 `--background`、`--card`。值一致但存在重复定义，未完全「单源」。涨跌色 `#0ECB81/#F6465D` 一致 ✅ |
| A2 | 数字等宽，价格更新不跳动，小数位未被截断 | ✅ | `tabular-nums` 全站价格/盘口/余额广泛使用（100+ 处）；`lib/decimal.ts` 字符串运算保精度 |
| A3 | 6 个基础组件状态完整，全站复用无重复实现 | ❌ | 规范第 2 节要求 6 个组件，实际只有 **2 个独立组件**：`PriceBadge.tsx`、`confirm-dialog.tsx`。缺失 4 个：**Stepper Input**（内联在 `TerminalOrderForm.tsx` 的 `.term-stepper`）、**Percent Selector**（内联为 `.term-slider-stops`）、**Trade Button**、**Pro Data Table** |
| A4 | 按钮 6 态 / 输入框 5 态 | ⚠️ | `button.tsx`、`input.tsx` 存在，未核对 6/5 态是否齐备 |
| A5 | 动画规范（Tab 150ms 等）+ 尊重 reduced-motion | ⚠️ | `prefers-reduced-motion` 已落地（`index.css:169/250`）✅；各动画时长是否对齐 1.9 未逐项核 |

### B. 交易终端（5 项）

| # | 规范原文 | 核对结果 | 证据 |
|---|---|---|---|
| B1 | 桌面三栏/五栏比例正确，中央图表 ≥400px | ⚠️ | `.term-col--pairs`(172px)/盘口/成交/下单列存在；但交接称币种栏 172px，规范附录 A 要求 ≥1920px 为 220px，未完全对齐 |
| B2 | 订单簿桌面 10 档 / 移动 5 档，深度背景不遮挡文字 | 🔬 | `TerminalOrderBook.tsx` 有聚合/深度条逻辑；移动端 `ProfessionalMobileTradeTerminal.tsx` 取 `slice(0,6)`（**6 档，非规范 5 档**）⚠️ |
| B3 | K线桌面内嵌正常，移动端底部抽屉打开/关闭/展开正常 | 🔬 | `ChartDrawer.tsx` 底部抽屉（36px 收起 / 210px 展开），但**展开固定 210px，与规范 3.3「65dvh→92dvh」不符** ⚠️；桌面 K 线内嵌 ✅ |
| B4 | 下单面板排列顺序正确，现货与合约参数不混用 | ✅ | `TerminalOrderForm.tsx` 顺序：买卖切换→限价/市价→价格→数量→百分比→余额→预估→提交，与规范 3.1 一致；现货/合约各自独立 |
| B5 | 底部委托 5 个 Tab 顺序正确，撤单沿用原有流程 | ⚠️ | 规范 3.4 要求 5 个 Tab（当前委托→历史委托→成交历史→当前持仓→资产与盈亏）；交接文档第 66 行称「当前委托/订单历史/成交明细/资产」**4 个**，顺序与数量不符，需核对 `Pages.tsx` 实际实现 |

### C. 响应式（5 项）

| # | 规范原文 | 核对结果 | 证据 |
|---|---|---|---|
| C1 | 12 个验收尺寸全部无横向溢出 | 🔬 | 需 1920/1600/1440/1366/1280/1024 + 320/360/375/390/414/430 逐一实测 |
| C2 | 移动端独立布局，无桌面 DOM 缩小版 | ✅ | `ProfessionalMobileTradeTerminal.tsx` 独立移动组件（单列、大按钮、底部导航）；另有 `Pages.tsx` 移动分支 |
| C3 | 底部导航五项，适配安全区，二级页面不重复 | ✅ | `BottomNav.tsx` 五项 Home/Markets/Trade/Assets/My ✅；`index.css:1164` `calc(60px + env(safe-area-inset-bottom))` ✅；`navigation.ts` 用 `top/sub/standalone` 分层 ✅ |
| C4 | 键盘不遮挡提交按钮，输入框 ≥16px | ⚠️ | 前端 `index.css:130` 是 `min-height:44px`（非字体）；`@media(max-width:768px){input{font-size:16px}}` 仅见于 backend 侧 CSS，前端是否覆盖需实测 |
| C5 | 弹窗/抽屉适配 dvh 与安全区，内部滚动正常 | ✅ | `index.css:1463` `max-height:min(92dvh, calc(100dvh - env(safe-area-inset-top) - 8px))`、`:511` drawer 用 `100dvh` ✅ |

### D. 性能与业务（5 项）

| # | 规范原文 | 核对结果 | 证据 |
|---|---|---|---|
| D1 | 高频更新不闪烁、不整页重渲染 | ⚠️ | `requestAnimationFrame` 仅 `Pages.tsx:618`（K线 priceLine）与 `LanguageMenu.tsx:72`；**订单簿/成交未见 rAF 合并**，`useMarketStream.ts` 需进一步核对 |
| D2 | 无重复订阅，无内存泄漏 | 🔬 | 需核对 `useMarketStream.ts` / `useMarketStreamEvent.ts` 的 cleanup |
| D3 | 未修改交易接口、下单参数、资金校验、风控逻辑 | ✅ | 交接文档声称未触碰；git 改动集中 UI 与行情网关 CORS/挂载，未发现交易/风控改动（未逐一 diff 后端 Python） |
| D4 | 未删除任何现有业务功能与入口 | ⚠️ | git 删除了 `src/_unused/`（ChartSection/QuickOrderDrawer/TradingChart/tradeMath），commit 7cb4011 称「detached unused experiments」，需确认无路由引用 |
| D5 | 无虚假行情数据，无静态数据冒充实时数据 | ✅ | `api.ts` `getMarkets()` 改为抛错（`MARKET_DATA_UNAVAILABLE` 等），不再回退 `getSampleMarkets()` 样例数据 ✅ |

---

## 三、硬性失败项（必须修复）

### ❌ F1：编译不通过（`tsc` 报 85 错误）

**现象**：`tsc --noEmit`、`tsc -b`、`npm run lint` 均报错，85 个错误**全部来自 `scripts/probe-live-terminal.cjs`**。

**根因**：`frontend/tsconfig.json` 的 `exclude` 为 `["node_modules", "dist", "src/_unused"]`，**未排除 `scripts/`**；且 `allowJs: true` + `moduleDetection: force`，导致 `scripts/*.cjs` 被当作 TS 模块解析，CommonJS 语法触发 `TS1434` 等错误。

**影响**：交接文档 `TRADE-TERMINAL-HANDOFF-2026-11-19.md` 第 360 行声称「`tsc --noEmit` ✅ 0 错误」**在当前状态下不成立**。

**修复建议**（二选一）：
1. 在 `tsconfig.json` 的 `exclude` 中加入 `"scripts"`；
2. 或把 `scripts/*.cjs` 移到被 exclude 的目录。

> 注：`src/` 目录本身 0 错误（已用 `grep -c '^src/'` 验证为 0），业务代码类型干净，问题仅出在构建配置未排除脚本目录。

---

## 四、需实测确认项（建议启动本地服务逐项验证）

| 项 | 内容 |
|---|---|
| T1 | 订单簿桌面是否 10 档、移动 5 档（移动端代码 `slice(0,6)` 为 6 档，疑似不符） |
| T2 | K线移动端抽屉展开高度（代码固定 210px，规范要求 65dvh→92dvh） |
| T3 | 底部委托 Tab 数量与顺序（规范 5 个 vs 交接称 4 个） |
| T4 | 12 个验收尺寸横向溢出检查 |
| T5 | 移动输入框字体 ≥16px 实测 |
| T6 | 高频组件是否整页重渲染（Performance 面板） |

---

## 五、i18n 检查结果

- ✅ 8 语言包（en/ja/zh-CN/es/pt/it/de/vi）各 **1517 keys，100% 覆盖，0 缺失，0 重复，0 非法值**。
- ⚠️ 仍有 **28 个未登记的 `t()` key**（`Est. APR`、`Total staked`、`Stake now`、`How mining works` 等，集中在 Earn/NewListings 页面），回退英文显示 —— 与交接文档「已知遗留」第 366 行一致。

---

## 六、验收结论

| 判定 | 说明 |
|---|---|
| **不通过（需整改后复验）** | 存在硬性失败项 F1（编译不通过），以及至少 4 处与设计规范明显不符：6 基础组件缺 4 个、移动盘口 6 档≠5 档、K线抽屉 210px≠65-92dvh、底部 Tab 4 个≠5 个 |

**整改优先级**：
1. 【P0】修复 `tsconfig.json` exclude 未含 `scripts/` 导致的编译失败（影响 CI/构建）。
2. 【P1】补齐 6 个基础组件中缺失的 4 个（Stepper Input / Percent Selector / Trade Button / Pro Data Table），或明确「内联实现」为合规替代并记录。
3. 【P1】核对移动端盘口档数（6→5）与 K 线抽屉展开高度（210px→65-92dvh）。
4. 【P2】核对底部委托 Tab 数量与顺序（规范要求 5 个）。
5. 【P2】启动本地服务，完成 T1–T6 实测项，补全「响应式 12 尺寸」验收矩阵。

---

## 附：证据文件索引

- 设计 Token：`frontend/src/styles/btcbox-design-tokens.css`、`frontend/src/index.css`
- 6 基础组件现状：`frontend/src/components/ui/`（仅 `PriceBadge.tsx`、`confirm-dialog.tsx`）
- 下单面板：`frontend/src/features/trade/TerminalOrderForm.tsx`
- 订单簿：`frontend/src/features/trade/TerminalOrderBook.tsx`
- 移动端：`frontend/src/features/trade/ProfessionalMobileTradeTerminal.tsx`、`ChartDrawer.tsx`
- 底部导航：`frontend/src/components/layout/BottomNav.tsx`
- 行情降级：`frontend/src/lib/api.ts`（`getMarkets` 抛错）
- 编译配置：`frontend/tsconfig.json`

