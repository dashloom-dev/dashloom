# Connector SDK 与指标接入

Dashloom 通过产品级或工作空间级 HTTP API 接收来自支付系统、产品分析、数据库、脚本和第三方连接器的标准化指标。

如果你的服务更适合被定时拉取而不是主动推送，可以使用 [Custom REST 指标合约](custom-rest-setup.zh-CN.md)；两条路径最终写入同一套标准化证据层。

## 创建接入密钥

普通的单产品数据发送程序应进入 **数据源 → 直接产品接入**，选择产品、创建产品级密钥，并复制系统生成的服务端命令。发送真实聚合数据后点击 **验证连接**，即可核对数据是否持久化、密钥是否被使用，以及哪些专属 Agent 已获得足够的近期数据。

只有可信的多产品数据管道才应在 **设置 → 扩展能力** 中创建工作空间级密钥。产品级密钥不能写入同一工作空间下的其他产品。Dashloom 只保存密钥的 SHA-256 哈希，无法恢复明文；密钥丢失时应撤销并重新创建。

请把密钥保存为服务端 Secret `DASHLOOM_API_KEY`，不要放在浏览器、移动应用、日志或源码中。

## 写入指标

```bash
curl https://your-dashloom.example/api/ingest/v1/metrics \
  -H "Authorization: Bearer $DASHLOOM_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"rows":[{"productId":"产品 UUID","source":"billing","metric":"mrr","metricDate":"2026-08-26","value":1299,"dimensions":{"currency":"USD"}}]}'
```

每次请求支持 1–1000 条数据。`productId` 必须属于密钥所在工作空间；使用产品级密钥时，还必须与该密钥绑定的产品一致。工作空间、产品、来源、指标、日期和维度相同的数据会更新已有记录，不会重复累加。

零依赖 TypeScript 客户端位于 [`sdk/typescript`](../sdk/typescript/README.md)。

如果数据源是用户自己 Cloudflare 账号内的 D1 数据库，可以部署 [Cloudflare Connector Worker](../examples/cloudflare-connector-worker/README.zh-CN.md)。它通过 D1 Binding 读取固定聚合表，只发送标准化指标，因此 Dashloom 部署不会获得 D1 凭证或任意查询权限。

## 指标约定

- `source`：小写来源标识，如 `stripe`、`posthog`、`custom_etl`。
- `metric`：小写语义名称，如 `mrr`、`active_users`、`trial_conversion_rate`。
- `metricDate`：报告时区下的 ISO 日期（`YYYY-MM-DD`）。
- `value`：有限数值，同一指标必须保持单位一致。
- `dimensions`：最多 12 个标准化低基数标量字段，字符串值最长 120 个字符。`email`、`ip_address`、`user_id`、`customer_id`、`session_id`、`token`、`request_body` 等原始身份、请求和密钥字段会被拒绝。

成功响应会返回写入数量。鉴权、结构或工作空间边界校验失败时返回 JSON 错误，不会接受无效批次。
