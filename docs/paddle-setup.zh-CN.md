# Paddle Billing 收入配置

Dashloom 会把 Paddle Billing 财务记录转换成按币种分离的每日证据，供 SaaS Revenue Agent 使用。系统只使用服务端只读 API，不保存客户、地址、发票、商品、结账或交易身份信息。

## 1. 创建最小权限密钥

进入 Paddle 的 **Developer tools → Authentication → API keys**，创建服务端 API Key，并且只授予：

- `transaction.read`；
- `adjustment.read`。

请设置过期日期并定期轮换，不要使用 Paddle.js 客户端 Token。Dashloom 中选择的环境必须与密钥一致：`pdl_live_…` 选择 **Production**，`pdl_sdbx_…` 选择 **Sandbox**。

## 2. 连接卖家账号

进入 **数据源 → Paddle Billing 收入**，选择承接这个卖家账号收入的 Dashloom 产品、环境并粘贴 API Key。Dashloom 会先验证两项只读权限，再加密保存密钥；浏览器以后不会再次读取已经保存的密钥。

一个 Paddle 卖家连接映射到一个 Dashloom 产品。如果同一个卖家账号需要拆分到多个产品，请通过 Custom REST 或鉴权数据接入发送已经聚合好的产品级证据，不要复制客户或交易明细。

## 3. 同步证据

先手动执行一次 **Sync Paddle**，随后可以创建 Paddle 自动同步计划。Dashloom 固定请求 API v1，只跟随 Paddle 在响应中返回、且仍属于固定 Paddle 域名的游标 URL；如果有界历史扫描达到上限，同步记录会明确标记为 partial。

系统保存以下每日指标：

- 来自 `details.totals.grand_total` 的已完成交易收入；
- 已完成付费交易数；
- 已完成订阅关联交易数；
- 已批准退款；
- 已批准拒付及拒付撤销。

金额始终按 ISO 币种分开，并正确处理零小数币种。待审核或被拒绝的退款、draft/ready/billed/尚未 completed 的 paid 交易、客户字段、自由文本元数据和 Provider 实体 ID 都不会保存。

官方资料：[鉴权与 API Key 权限](https://developer.paddle.com/api-reference/about/authentication)、[交易列表](https://developer.paddle.com/api-reference/transactions/list-transactions)、[调整列表](https://developer.paddle.com/api-reference/adjustments/list-adjustments)和[游标分页](https://developer.paddle.com/api-reference/about/pagination)。
