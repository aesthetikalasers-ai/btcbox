# 2号 AI 批次记录 — 账户与订单刷新 / Admin 充值审核边界

日期：2026-11-08（UTC+8）
仓库：`avali9308-code/btcboxcdt`
分支：`work/2ai-market-stale-state-20261108`
基准集成分支：`work/btcbox-unified-20261104`

## 本批处理

- `frontend/src/features/assets/AssetsPage.tsx`
  - 增加页面重新获得焦点或从后台切回可见状态时的账户快照刷新。
  - 每次刷新取消上一请求，并用请求序号阻止过期响应覆盖较新的账户快照。
  - 刷新期间不继续展示旧余额；请求失败时不保留可能过期的余额。
  - 卸载时取消请求并移除事件监听。
- `frontend/src/features/orders/OrdersPage.tsx`
  - 增加页面重新获得焦点或重新可见时的订单历史刷新。
  - 采用相同的取消旧请求、请求序号保护和卸载清理机制。
  - 刷新期间清除旧订单快照；失败时不保留旧订单记录。

## Admin 充值流程核对

- SOURCE OBSERVED：Admin 的 `deposits` 标签当前管理收款地址、提现费率和公告配置，不是充值待审核队列。
- SOURCE OBSERVED：员工手动入账入口位于 Users 用户详情中的 Manual credit 区域；该操作要求选择用户、资产、金额和 TxID/收据参考，并通过 `admin/deposit/confirm` 提交。
- SOURCE OBSERVED：用户详情显示最近 20 条充值历史，并标注账本来源；更广的财务事件轨迹通过 Audit log 查看。
- SOURCE OBSERVED：当前 React Admin API 客户端未发现独立的 pending deposit queue 查询接口。因此不能只改前端就声称实现了链上充值自动识别或独立待审核充值队列。
- 处理决定：保持现有半人工核实后入账模式，不伪造待审数据，不更改 Core 资金接口或真实资金流程。本轮未执行手动入账、提现审批或任何资金写操作。
- 后续若需要独立充值审核队列，应先由 Core/架构确认待审充值记录的数据源、状态机、权限和 API 契约，再由 2号接入 UI。

## 验证状态

- 上一批 backend CI：SUCCESS；统一构建、后端测试、fail-closed preflight 和输出入口检查通过。
- 上一批 frontend CI：SUCCESS；npm install、lint、build、Chromium 安装和桌面/移动路由 smoke tests 全部通过。
- 本批前端修改已推送，等待本批精确 HEAD 的新一轮 CI；在新 CI 完成前不宣称本批测试通过。
- 未合并、未部署、未操作生产数据库或真实资金。

## 本批范围外 / 未验证

- 未验证生产环境账户接口在真实登录会话中的实时数据刷新表现。
- 未验证 Core 是否存在未被 React API 客户端接入的充值待审接口。
- 未做手动截图视觉验收；自动路由 smoke tests 不能代替真实设备视觉验收。
