# Polar 收入连接教程

Dashloom 从 Polar 导入隐私最小化的商业证据，用于 Revenue Agent 和定期报告。系统只保存按日期、币种聚合的净订单收入、退款金额和支付交易数；不会保存客户 ID、姓名、邮箱、账单地址、描述、metadata、发票号、Checkout ID、订阅 ID 或订单 ID。

## 创建 Token

1. 在 Polar 的组织设置中创建 Organization Access Token。
2. 只授予 `orders:read`。Dashloom 不需要产品、客户、订阅、退款写入或组织写入权限。
3. 确认 Token 属于 **Production** 还是 **Sandbox**；Polar 会隔离两个环境的数据、用户、Token 和组织。
4. 如果一个 Dashloom 产品只对应某个 Polar 产品，可以复制该 Polar Product ID。

## 连接和同步

1. 在 Dashloom 打开 **数据源 → Polar revenue**。
2. 选择 Dashloom 产品和对应环境。
3. 填写连接名称、Organization Access Token，并按需填写 Polar Product ID。
4. 点击 **Connect Polar**，然后点击 **Sync Polar**；也可以在 **Automation** 中创建 Polar 定时同步。

Token 只会发往固定的 `https://api.polar.sh/v1` 或 `https://sandbox-api.polar.sh/v1`，并在保存前加密。工作空间使用 Token 指纹、环境和可选产品范围区分连接，因此可以同时接入多个 Polar 组织或产品范围。

Dashloom 最多读取最新 1,000 个订单，并过滤到此前 60 天和当天。如果仍有更多分页，同步会标记为部分完成，Agent 证据也会标记为截断；Agent 必须披露覆盖不完整，不能把未读取的订单解释成零。

收入采用 Polar 的 `net_amount`（折扣后、税前），退款采用 `refunded_amount`；系统不会静默合并不同币种。

官方参考：[API 鉴权与环境隔离](https://polar.sh/docs/api-reference/introduction)、[订单列表与分页](https://polar.sh/docs/api-reference/orders/list)和[订单金额语义](https://polar.sh/docs/api-reference/orders/get)。
