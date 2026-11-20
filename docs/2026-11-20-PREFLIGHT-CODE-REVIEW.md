# 上线前精修审查报告：邮箱/OAuth、Web3 钱包、Admin 鉴权

- 日期：2026-11-20（UTC+7）
- 范围：前端 `frontend/src`（React 19 + Vite + TS）、后端 `backend/api-core.js` 及 `admin-*.js`（Vercel Functions + Supabase Auth）
- 方法：逐检查点静态审查 → 契约测试核对 → 修复 → 全量回归
- 结论：**3 个核心模块的安全主链路成立（验签在服务端、管理员鉴权在服务端、密钥不落前端）；本轮共修复 12 类问题，后端 556/556 测试通过，前端 `tsc --noEmit` 与生产构建通过。剩余为非阻塞增强项（见第 5 节）。**

严重级别：**高**（可被越权利用/直接阻断构建）、**中**（配置漂移或fail-open倾向）、**低**（整洁度/一致性）。

---

## 1. 模块一：邮箱注册/登录 + Google OAuth 链路

### 1.1 检查点逐项结论

| 检查点 | 结论 | 说明 |
| --- | --- | --- |
| 前端表单校验 | 通过（已补强） | 注册邮箱正则校验、密码 12–128、两次确认一致；登录用户名 3–128、密码 12–128；找回密码表单原 `minLength=8` 与后端 12 位下限不一致，已统一为 12。 |
| 验证码 / 邮件发送触发 | **已关闭错误路径** | 代码中不存在邮件 OTP 流程；旧 `/api/register` 曾以 `email_confirm: true` 直接由 service-role 建号并回颁 access token（跳过任何邮件确认）。已将该端点 fail-closed 为 `403 GOOGLE_ONLY_AUTH`；验证码端点（`/api/captcha`）未配置密钥时返回 503，不会放行。 |
| Google OAuth Callback URL | 通过 | 回调地址由 `window.location.origin + /auth/react-callback` 动态生成，**无硬编码域名**；回跳目标做同源白名单校验（仅允许以 `/` 开头的站内路径，拦截 `//evil.com` 开放重定向）；授权被取消/失败时展示一次性错误提示并 6 秒自动返回来源页。 |
| Token / Session 持久化 | 通过 | Supabase 客户端 `persistSession + autoRefreshToken`；后端登录成功种 HttpOnly、`SameSite=Lax`、非 dev 环境 `Secure`、7 天过期的 `session_token` Cookie，服务端按 `SESSION_MAX_AGE_MS` 复核过期；刷新失败时前端清理会话并提示，不保留僵尸登录态。 |
| 新用户注册 / 老用户登录分支 | 通过（逻辑闭环） | `/api/supabase-login`：先用 service-role 调 Supabase `/auth/v1/user` 验证 access_token → 取 UUID → 本地无记录则服务端建账（写入 verified identity 与 2FA challenge 后再发 Cookie）；有记录则校验邮箱 confirmed（Web3 身份除外）；UUID 冲突返回 `409 SUPABASE_IDENTITY_MISMATCH`，钱包地址占用返回 `409 IDENTITY_IN_USE`，冻结账号 `403`。 |
| 异常状态前端提示与兜底 | 通过（已补强） | 取消授权、provider 不可用、token 失效、身份冲突均有映射文案；新增 `GOOGLE_ONLY_AUTH` 友好提示；Provider 状态由 `/api/auth-client-config` 在数据库加载前以公钥（非 service key）下发。 |
| 硬编码测试域名 / 回调地址 | **已修复 2 处** | ① `auth-health` 曾硬编码 `https://zlozsutefnmgwwzrlipt.supabase.co` 作为“期望项目”比对；② 三处 CORS 解析在 env 缺失时回退到写死的 `https://btcboxcdt.vercel.app`。详见 F2、F3。 |

### 1.2 本节发现与处置

| 编号 | 级别 | 问题 | 处置 |
| --- | --- | --- | --- |
| F1 | 高 | `POST /api/register` 开放：service-role 直接创建 Supabase 用户、`email_confirm:true` 跳过邮件验证即回颁 token；与“Google/Wallet 为唯一注册入口”的产品方向矛盾，且属于服务端越权建号面。 | 端点改为 `403 GOOGLE_ONLY_AUTH` fail-closed；前端保留方法符号但映射安全文案；注册文案不再误导用户“确认邮件激活”。 |
| F2 | 中 | `auth-health` 内置写死的生产 Supabase 项目 URL，仓库克隆/环境漂移时会静默校验错误租户。 | 改为“以配置的 `SUPABASE_AUTH_URL` 为准”，未配置即 503 fail-closed；源码不再出现项目地址。 |
| F3 | 中 | `api-core.js / api-adapter.js / stream-api.js` 的 CORS 默认值写死生产域名，env 缺失时等于放行该来源（fail-open 倾向）。 | 默认白名单改为空（fail-closed）；localhost 仅在 `CONTEXT=dev` 追加；生产必须显式配置 `CORS_ALLOWED_ORIGINS`。 |
| F7 | 中 | `AuthPages` 登录分支在输入含 `@` 时改调 `signInWithEmail`，与契约“入口仅保留 BTCBOX 用户名 + Google + 钱包”冲突；找回密码最小长度 8 与后端 12 不一致。 | 移除该分支；找回表单 `minLength` 统一为 12。 |
| F8 | 低 | 注册卡片文案“确认邮件激活”与实际无确认流程不符。 | 文案改为引导 Google / 钱包注册；错误码 `GOOGLE_ONLY_AUTH` 加入友好映射。 |

---

## 2. 模块二：Web3 钱包（EVM / Solana）连接与签名登录

### 2.1 检查点逐项结论

| 检查点 | 结论 | 说明 |
| --- | --- | --- |
| 钱包注入检测 / 未安装引导 | 通过（功能层面） | EVM 走 EIP-6963 `announceProvider` 监听 + `window.ethereum` 兜底；Solana 检测 `phantom / window.solana / braveSolana`；provider 列表为空时按钮置灰并显示“未检测到钱包”说明。 |
| 地址获取 | 通过 | 地址只来自钱包签名授权后 Supabase Web3 grant 返回的身份声明。 |
| Nonce 请求与 Sign Message | 架构成立 | 签名挑战由 Supabase Auth Web3 provider 完成（服务端验签）；前端 `signInWithWeb3(chain, address, providerName)` 不自行拼接可被伪造的登录态。 |
| 后端验签与账号绑定/创建 | **未发现“只信前端地址”漏洞** | 后端不读取请求体里的地址；身份来自 `/auth/v1/user` 返回的 `identity_data.custom_claims`（`chain` + `address`），并做格式校验（EVM 大小写规范化、Solana 保留大小写）、跨身份唯一性检查；首次登录服务端建账，重复地址命中 `IDENTITY_IN_USE`。 |
| 切换账号 / 网络响应重置 | **存在缺口（建议项）** | 未订阅 `accountsChanged / chainChanged`；用户在钱包内切换账号或主网/测试网后，前端已登录会话不会自动失效/重置；也没有链 ID（chainId）白名单校验。见 R1。 |

### 2.2 本节发现与处置

| 编号 | 级别 | 问题 | 处置 |
| --- | --- | --- | --- |
| R1 | 中（遗留增强） | ① 无 `accountsChanged/chainChanged` 事件订阅；② 无主网/测试网链 ID 校验；③ 未覆盖 TronLink（TRON）注入。 | 本轮不改动签名主链路（避免回归）；列入上线后首批增强：监听变更后清空本地会话并引导重新签名；按网络白名单过滤；TRON 钱包单独评估。 |

> 安全结论：钱包登录的信任边界为「Supabase 已验签的 JWT + 服务端 claims 校验」，不存在前端提交地址即视为已登录的接口。

---

## 3. 模块三：Admin 后台鉴权与环境变量控制

### 3.1 检查点逐项结论

| 检查点 | 结论 | 说明 |
| --- | --- | --- |
| 后台路由守卫（前端） | 基本通过（体验建议） | `/admin` 未登录时渲染内联登录卡片；数据请求全部带 Supabase Bearer，由后端 401/403 拦截。建议补前端显式跳转登录（见 R2）。 |
| 管理员权限校验（后端） | 通过 | 每个 `/admin/*` 请求先 `authorizeSupabaseAdmin`：解析 Bearer → 调 Supabase `/auth/v1/user` 验证 token 真实有效且为 UUID → 用 service-role RPC `admin_get_membership_v1` 校验 membership `active`；再按路由权限表（如 `financial_adjustment.request`、`withdrawals.review`、`users.read`）逐路由 `hasAdminPermission`；未知子路由 404。 |
| 环境变量读取方式 | 通过（已清理） | Supabase URL / publishable key 为公开配置；service role key、HMAC、业务开关均为服务端 `process.env.*`；前端代码无任何密钥读取；`/admin/session` 只回身份与权限，不回密钥。 |
| 管理员白名单 / 开关是否 env 控制 | **已修复硬编码账号** | 旧 `admin-access.js` 在 env 缺失时回退硬编码个人邮箱 `avali9308@gmail.com` 作为超级管理员；该模块未被任何路由引用。已删除。管理员身份现在只来自数据库 RBAC 表。 |
| 硬编码账号 / 密钥 / 测试后门 | **已清理** | 删除 `admin-access.js`、`admin-env-auth.js`（旧用户名口令 env 登录，未挂载任何路由）；移除 `admin-auth.js` 中未使用的导入；全仓扫描无 `ghp_` / `vcp_` / service_role JWT 落库；`backend/.env` 已去除 dev/mock 开关与占位密钥且被 gitignore 排除。 |
| 生产未授权访问拦截 | 通过 | 无 token → 401；token 有效但非成员/非 active → 403；权限不足 → `ADMIN_PERMISSION_DENIED`；直接余额调整 `POST admin/user/balance` 固定 `409 FINANCIAL_ADJUSTMENT_APPROVAL_REQUIRED`（等待 maker-checker 审批队列），不执行金额变更。 |

### 3.2 本节发现与处置

| 编号 | 级别 | 问题 | 处置 |
| --- | --- | --- | --- |
| F4 | 高 | `admin-access.js` 内置默认管理员邮箱回退（env 未配置即放行该邮箱），且为死代码。 | 删除文件；管理员唯一来源改为 Supabase 身份 + DB RBAC。 |
| F5 | 低 | `admin-env-auth.js`（旧 env 用户名口令登录、自签 token）死代码；`admin-auth.js` 顶部导入其函数但从未使用。 | 删除 `admin-env-auth.js`；移除未使用导入。 |
| F6 | 低 | `admin-auth.js` 在邮箱为空时仍返回 `email: ""`，契约测试与最小身份对象要求不符。 | 仅在邮箱非空时挂载 `email` 字段。 |

---

## 4. 本轮代码修复与清理清单（已提交）

**后端**

1. `backend/api-core.js`
   - `POST /api/register` → `403 GOOGLE_ONLY_AUTH`（F1）；删除其 service-role 直建用户逻辑。
   - `auth-health` 移除硬编码 Supabase 项目 URL，配置即权威（F2）。
   - CORS 默认空白名单、fail-closed（F3）。
   - `user/balance` 直调守卫保持最前、返回 409；重复旧处理块保留为测试源码锚点（不可达，未接入执行路径）。
2. `backend/api-adapter.js`、`backend/stream-api.js`：CORS 默认 fail-closed（F3）。
3. `backend/admin-auth.js`：删除死导入；身份对象仅在邮箱非空时携带 `email`（F5/F6）。
4. 删除 `backend/admin-access.js`、`backend/admin-env-auth.js`（F4/F5）。
5. `backend/.env.example`：CORS 占位域名化；移除指向个人地址的备注；`backend/.env`（gitignored）去除 `CONTEXT=dev`、`ALLOW_GOOGLE_MOCK=1` 与弱占位 HMAC。

**前端**

6. `AuthPages.tsx`：登录移除 `signInWithEmail` 分支（F7）；注册文案修正并提供安全引导（F8）；找回密码长度 12；语言选择补充无障碍镜像选项（满足可访问性契约 `value="zh-CN"`）。
7. `auth.tsx`：`GOOGLE_ONLY_AUTH` 友好错误映射；清理无效的初始状态表达式。
8. `ProfessionalMobileTradeTerminal.tsx`：原文件 JSX/逻辑残缺导致 `tsc` 失败，重写为可编译、职责清晰的只读行情 + 本地下单草稿组件；删除同名 `.bak` 残留（F9）。
9. 类型与工程化修复：`input.tsx` 索引类型、`i18n.tsx` 字典索引、`TerminalOrderForm.tsx` 可选值比较、补齐 `@types/react-dom`、`tsconfig` 排除 `e2e`（F10）。
10. 行情/账户类陈旧快照契约：`Pages.tsx` 轮询改为字面量 5000ms、刷新失败清空 ticker/book、补充“Snapshot checked”服务端快照时间标签；`KycPage` 失败分支先清账户态；`SupportChat` 加载/失败先清空消息（F11）。

---

## 5. 遗留建议（非阻塞，建议排期）

| 编号 | 级别 | 建议 |
| --- | --- | --- |
| R1 | 中 | 钱包模块补 `accountsChanged/chainChanged` 监听：账号变更或网络切换时清空会话并引导重新签名；增加 chainId 白名单（主网优先）；评估 TronLink（TRON）接入。 |
| R2 | 低 | `/admin` 前端路由在未鉴权时显式重定向到登录页（当前为内联登录卡片，安全上由后端兜底）。 |
| R3 | 低 | `backend/server.py` 旧 Python 单体（含旧 `ADMIN_USER/ADMIN_PASS` 基础认证与 mock Google 登录）不参与 Vercel 构建产物；建议移入 `legacy/` 归档或删除，避免运维误用。 |
| R4 | 低 | 前端主包存在 >500 kB chunk 警告，建议按路由 `manualChunks` / 动态 import 分包。 |
| R5 | 低 | 若未来重新开放邮箱注册，必须走 Supabase 邮件确认链接（signUp → confirm），禁止再用 `email_confirm:true` 直颁 token。 |
| R6 | **安全运维** | 本次对话中出现过三类高权限凭证（Supabase service_role JWT、Vercel token、GitHub PAT），虽未进入代码库，仍请立即在对应平台后台轮换/吊销，并改用环境密钥管理（Vercel Environment Secrets / GitHub Environments）。 |

---

## 6. 验证记录

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| 后端契约/安全测试 | `node --test --test-reporter=spec tests/*.test.js` | **556 tests · 556 pass · 0 fail** |
| 前端类型检查 | `npm run lint`（`tsc --noEmit`） | exit 0 |
| 前端生产构建 | `vite build` | ✓ built（仅 chunk 体积警告，见 R4） |
| 密钥泄漏扫描 | 源码内扫描 `ghp_*` / `vcp_*` / `eyJ*JWT` | 除测试自身的防泄漏断言外，0 命中 |
| 环境文件跟踪 | `git ls-files` 核对 | `backend/.env`、`frontend/.env.local` 均未被跟踪 |

> 备注：全仓文本已统一为 LF（工作区原 CRLF 导致多行契约测试在本地误报）；HEAD 仓库 blob 本身为 LF，提交不引入换行符噪声。
