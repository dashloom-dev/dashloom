# Lemon Squeezy 收入配置

Dashloom 会从一个 Lemon Squeezy Store 导入近期订单收入与退款，以及当前订阅 MRR、付费客户和试用客户。每个 Store 连接映射到一个 Dashloom 产品。

## 创建并连接凭证

1. 在 Lemon Squeezy 中进入 **Settings → API** 并创建 API Key。Live 与 Test Key 相互独立，并遵循 Lemon Squeezy 的有效期策略。
2. 从 Lemon Squeezy 后台或 API 找到数字形式的 Store ID。
3. 先在 Dashloom 中创建目标产品。
4. 打开 **数据源 → Lemon Squeezy revenue**。
5. 填写连接名称、产品、Store ID 和 API Key，然后点击 **Connect Lemon Squeezy**。
6. 执行第一次同步，或创建自动同步计划。

系统只会向固定的 `https://api.lemonsqueezy.com` 地址验证 Key，并在持久化前加密。读取 API 和工作空间导出都不会返回该 Key。

## 导入的证据

- 最近 14 天按订单日期和订单币种记录的 `revenue` 与 `refunds`；
- 根据标准、非用量计费的有效订阅价格计算，并以 Store 币种记录的 `mrr`；
- `paid_customers`，包括仍处于宽限期的已取消订阅；
- 来自 `on_trial` 订阅的 `trialing_customers`。

系统会排除 Test Mode 订单和订阅，不统计 pending、failed 与 fraudulent 订单。不同订单币种在看板和 Agent 证据中始终分开。用量计费订阅不进入 MRR，因为当前用量并不代表稳定的循环承诺。

每个分页集合一次同步最多读取 1,000 条记录，并最多解析 100 个不同的有效价格。如果 Store 超出这些安全边界，可暂时通过 Connector SDK 建立更窄的集成，等待后续高数据量连接器。

官方参考：[API 请求与鉴权](https://docs.lemonsqueezy.com/api/getting-started/requests)、[订单对象](https://docs.lemonsqueezy.com/api/orders/the-order-object)、[订阅对象](https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object)和[价格对象](https://docs.lemonsqueezy.com/api/prices/the-price-object)。
