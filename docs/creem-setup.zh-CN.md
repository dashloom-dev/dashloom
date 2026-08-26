# Creem 收入连接教程

Dashloom 会从 Creem 导入经过隐私最小化处理的商业证据，用于 Revenue Agent 分析和定期报告。系统只保存按日期、币种聚合的已支付总收入、退款、支付交易数和拒付数；不会保存客户 ID、姓名、邮箱、交易描述、税务国家、metadata、订单 ID 或订阅 ID。

## 创建连接

1. 在 Creem 后台进入 **Developers → API Keys**，创建服务端 API Key。
2. 在 Dashloom 中打开 **数据源 → Creem 收入**。
3. 选择 **Production** 或 **Test mode**；Creem 会隔离两个环境及其 Key。
4. 选择收入所属的 Dashloom 产品。
5. 可以填写 `prod_…` 格式的 Creem Product ID，将导入范围限制到单个产品；留空则导入该 Key 可见的全部产品。
6. 填写连接名称和 API Key，然后点击 **Connect Creem**。
7. 点击 **Sync Creem**，或在 **Automation** 中创建 Creem 自动同步计划。

系统只会向固定的 `https://api.creem.io` 或 `https://test-api.creem.io` 地址验证 Key，并在写入前加密；读取 API 和工作空间导出都不会返回 Key。同一个 Key、环境和产品范围再次连接时会更新原连接，不同 Key 或产品范围则会创建独立映射。

## 指标语义

- `revenue` 使用已支付及发生退款的商业交易中的 `amount_paid`，并除以 100。
- `refunds` 单独记录 `refunded_amount`，不会暗中从总收入中扣除。
- `paid_transactions` 表示已支付商业交易数量。
- `chargebacks` 表示拒付状态交易数量，不计入已支付收入。
- 币种保留在指标维度中；Dashloom 不会合并或直接比较不同币种。

每次同步读取此前 60 天和当天的数据，每个连接最多读取 1,000 笔交易。达到安全上限时，同步任务会标记为 `partial` 并披露截断。系统不会仅凭交易历史推算 MRR，因为交易记录不能证明当前有效订阅状态。

官方参考：[API 鉴权与环境隔离](https://docs.creem.io/api-reference/introduction)和[交易搜索结构](https://docs.creem.io/api-reference/endpoint/get-transactions)。
