# 连接 Cloudflare Analytics

> 兼容性说明：当前 Community 控制台不再把它作为新的业务数据源连接入口。代码仍保留已有自托管映射和 API 路由以兼容旧部署；新的运维聚合数据应通过标准化导入路径接入。

Dashloom 通过 Cloudflare GraphQL Analytics API 读取 Worker 运行指标，以及 R2 请求、错误、存储、对象和待完成上传指标。一个工作空间可以连接多个 Cloudflare 账号；每个产品可以分别映射一个 Worker 和一个 R2 Analytics Bucket。

## 创建最小权限 Token

1. 打开 **Cloudflare Dashboard → Manage Account → Account API Tokens**。
2. 选择 **Create Token → Custom token**。
3. 填写便于识别的名称，例如 `Dashloom analytics`。
4. 添加 **Account → Account Analytics → Read**。如需让 Dashloom 自动列出 Worker 名称，再添加 **Account → Workers Scripts → Read**；手动填写名称时不需要第二项权限。
5. Account Resources 只选择 Dashloom 需要分析的账号。
6. 如部署条件允许，可以增加有效期和客户端 IP 限制。
7. 创建并复制 Token；Cloudflare 只会完整显示一次。

官方文档：[Configure an Analytics API token](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)。

## 获取 Account ID 与 Worker 名称

Account ID 可以在 Cloudflare 账号概览或 Worker 设置中找到。填写 Account ID 和 Token 后，可点击 **Discover Workers** 自动填充 Worker 名称选项。如 Token 有意只保留 Analytics 权限，也可以手动填写 **Workers & Pages** 中显示的部署名称；它不是自定义域名。

## 在 Dashloom 中连接

1. 先在 **Products** 中创建产品。
2. 打开 **Data sources → Cloudflare Operations**。
3. 填写连接名称、Account ID、API Token 和产品，自动发现并选择 Worker，或手动填写脚本名称。
4. 点击 **Connect Worker**。Dashloom 会先验证 Token 和账号，再用 AES-GCM 加密保存 Token。
5. 点击 **Sync connected accounts**，按照 Provider 限制分段刷新此前 60 天和当天的数据。

填写新的 Account ID 会增加一个账号；重复填写已有 Account ID 会轮换该连接的 Token。重新映射产品会替换它之前的 Cloudflare Worker 映射。

## 连接 R2 Bucket

1. 打开 **Data sources → Cloudflare R2**。
2. 使用同一个 Account ID 和具有 **Account Analytics → Read** 的 Token；R2 不需要 Workers Scripts Read。
3. 填写 Analytics Bucket 名称。Jurisdiction Bucket 必须包含 Cloudflare 要求的前缀，例如 `eu_bucket-name`。
4. 映射到 Dashloom 产品并点击 **Connect R2**。
5. 点击 **Sync R2**，或在 **Automation** 中单独创建 Cloudflare R2 同步计划。

Dashloom 查询 `r2OperationsAdaptiveGroups` 和 `r2StorageAdaptiveGroups`，按日保存请求数、错误数、Payload 字节、Metadata 字节、对象数和待完成分片上传数。只有 Cloudflare 返回存储快照时才写入存量指标；不会读取对象名称、对象内容、密钥或 Bucket 内容。

Cloudflare 只保留最近 31 天 R2 Analytics。因此每个 R2 指标都会标记 Provider 历史受限，月度 Agent 报告必须披露无法获得完整的上一组 30 天对比。官方参考：[R2 Metrics and analytics](https://developers.cloudflare.com/r2/platform/metrics-analytics/)。

## 验收

- Cloudflare 数据源卡片应显示已配置账号数量。
- **Cloudflare Operations Dashboard** 应出现请求、错误、子请求和 CPU 数据。
- **Overview** 应显示同步记录和指标总数。
- **Dashloom Agent** 的证据上下文应统计已导入的数据点。

Cloudflare Adaptive Analytics 属于分析估算值。Dashloom 会记录来源和采集时间，不会把它当作账单数据。

## 常见问题

- 同步时出现 `HTTP 401/403`：检查 Token、账号资源范围和 **Account Analytics: Read** 权限。
- 自动发现时出现 `HTTP 403`：添加 **Workers Scripts: Read**，或者继续使用权限更小的 Token 并手动填写 Worker 名称。
- `Account access returned HTTP 404`：Account ID 错误，或 Token 没有包含该账号。
- GraphQL 字段或可用性错误：当前套餐可能不提供该数据集；同步记录会保存返回的错误。
- 没有 Worker 数据：确认脚本名称完全一致，并且同步周期内有真实流量。
- 没有 R2 存储数据：检查 Bucket 名称和 Jurisdiction 前缀；Dashloom 不会把缺失的存储快照写成零字节。

不要把 Token 写入 `.dev.vars`、`wrangler.jsonc`、文档、截图、Issue 或聊天消息。只在已登录的 Dashloom 设置页面中填写。
