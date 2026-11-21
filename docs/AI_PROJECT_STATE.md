# BTCBOX — 项目交接状态

**更新日期：** 2026-11-16  
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

- 已新增 `docs/AI_STATUS_REPORT_TEMPLATE.md`，作为所有 AI、开发人员和项目协调负责人的强制进度汇报模板。
- 适用时机：开始任务、完成任务、阻塞、阶段验收及跨成员/跨会话交接。
- 必须记录阶段与退出条件、完成事项、修改文件、分支和完整 SHA、测试命令/结果/证据、未完成事项、阻塞、下一项唯一优先任务及规划一致性。
- 未验证事项标记 NOT VERIFIED；没有提交不得编造 SHA；阶段退出条件未满足不得报告通过。
- 该模板对所有参与者一视同仁，并要求重要进度后同步更新本状态文件。


## 2026-11-22 — Admin portal and KYC mobile image repair

- Owner explicitly instructed this repair to be committed directly to `main`; this task-specific instruction superseded the normal working-branch rule for these changes only. No merge or manual Vercel deployment was run.
- Main commits (latest first): `b0f74488bcd8c7cab2ab9600283a3a02208519f8` (admin entry tests), `f31597c1d75f1f8aea8e4e942b3539f4c1ded8b8` (admin route), `1f1623edbbbad7c6d37239ed5c462f1589d747d1` (dedicated admin sign-in surface), `8c43ef2b228631debe12c754440266c9e85c9a62` (KYC mobile decoder test), `77e2bc507d01a9986ece3d08e97b77c2b4b33ef0` (KYC mobile image preparation).
- Files changed: `frontend/src/features/pages/Pages.tsx`, `backend/tests/kyc-document-storage.test.js`, `frontend/src/features/admin/AdminPage.tsx`, `frontend/src/App.tsx`, `backend/tests/admin-entry.test.js`.
- KYC frontend now falls back from `createImageBitmap` to native `Image` decoding, accepts image file selection broadly (including HEIC/HEIF where the browser can decode it), and still converts to JPEG <=512 KB before upload. Private bucket and server-side validation remain unchanged.
- Admin portal now has an unmistakable standalone sign-in header and explicit `/admin/*` route coverage; authentication still uses the existing Supabase Auth + database RBAC flow. No bypass or static credentials were added.
- Verification: **NOT VERIFIED** — source updates committed successfully, but no local build/test runner was available in this session and no CI result has been observed yet. Production deployment status and real mobile upload/admin login flows remain **NOT VERIFIED**.
- Previous KYC decoder commits on `working` were left intact; this task did not merge or rewrite that branch.