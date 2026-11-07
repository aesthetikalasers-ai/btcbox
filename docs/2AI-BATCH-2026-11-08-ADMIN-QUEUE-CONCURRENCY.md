# 2号 AI 批次记录 — Admin 审核队列并发保护

日期：2026-11-08（UTC+8）
仓库：`avali9308-code/btcboxcdt`
分支：`work/2ai-market-stale-state-20261108`

## 本批改动

- `frontend/src/features/admin/AdminPage.tsx`
  - 提现审核队列增加独立请求序号；较早的刷新请求即使晚返回，也不能覆盖较新的队列快照。
  - KYC 审核队列增加独立请求序号；旧请求不能覆盖较新的审核队列。
  - 仅当前最新请求可以清除 loading 状态，避免旧请求提前结束新请求的加载状态。
  - 刷新失败时保持队列为空，不留下可能已过期的可操作审核项。
  - KYC approve/reject 成功后的读取统一经过受请求序号保护的刷新函数，成功提示与后续读取失败分开表达。
- `backend/tests/admin-api-contract.test.js`
  - 增加源码契约断言，验证提现/KYC 独立请求序号、过期响应丢弃，以及 KYC 审核后统一刷新路径。

## 交叉核对

- SOURCE OBSERVED：手动充值控件同时要求 `deposits.read` 与 `deposits.review`；KYC 与提现操作控件分别要求 `kyc.review` / `withdrawals.review`。
- SOURCE OBSERVED：服务端 Admin 路由权限映射由现有测试覆盖；本批没有更改权限定义或后端路由。
- SOURCE OBSERVED：KYC 审核通过按钮在证件未上传、URL 缺失或预览错误时禁用。
- SOURCE OBSERVED：员工手动充值仍然是核实收款后向选定用户/资产手动入账，不创建虚假的充值待审核订单。
- NOT VERIFIED：真实管理员会话下的并发浏览器交互、签名证件 URL 的实际可访问性和生产环境 API 读写状态。

## CI / 安全边界

- 精确 HEAD：`0656d45eee1bdb8774dd566db55f75a5c07756ec`（含本批代码、测试与协作文档）。
- Backend CI run：`42412669029`，记录时 in progress。
- Frontend CI run：`42412668943`，记录时 in progress。
- 未执行真实 KYC 审核、提现批准/拒绝/付款、手动入账或任何生产资金操作。
- 未改 Core 资金逻辑、数据库结构或 API 契约；未合并、未部署。
