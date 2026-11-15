# BTCBOX 专业交易终端升级执行包

## 内容
- `BTCBOX-完整执行指令.md`：复制给 VS Code AI 的完整执行要求。
- `reference/trading-terminal/`：六个参考文件，供 AI 阅读参考。

## 使用方式
1. 将整个 `reference` 文件夹复制到 BTCBOX 本地项目根目录下的 `docs/` 中，建议最终路径为 `docs/reference/trading-terminal/`。
2. 不要把参考文件复制覆盖到项目正式源码目录。
3. 在 VS Code 中打开 BTCBOX 项目根目录。
4. 将 `BTCBOX-完整执行指令.md` 全文发送给 AI，并告诉它参考文件位于 `docs/reference/trading-terminal/`。
5. 本包中的参考代码含示例静态数据和示例 Binance WebSocket 逻辑，仅供参考，不能直接视为 BTCBOX 已有实现或生产可用代码。

## 安全边界
指令要求 AI 保护未提交修改，不擅自写生产数据库、不下真实订单、不部署、不合并、不推送。
