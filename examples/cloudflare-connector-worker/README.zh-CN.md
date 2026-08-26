# Dashloom Cloudflare Connector Worker

这个独立 Worker 会在用户自己的 Cloudflare 账号内，通过 D1 Binding 读取固定的“仅聚合”数据表，再由每小时 Cron Trigger 将标准化指标推送给 Dashloom。Dashloom 能收到聚合证据，但不会获得用户的 D1 API Token、数据库凭证、原始事件或任意查询权限。

## 数据路径

```text
你的应用 → 自有 D1 中的 dashloom_metrics_daily
                              ↓ D1 Binding + 固定 SELECT
                    运行在自有账号的 Connector Worker
                              ↓ HTTPS + 工作空间接入密钥
                         你的 Dashloom 部署
```

Worker 每次最多接收 1,000 条聚合记录，回看范围限定为 1—7 天，每个指标最多携带 10 个用户维度，并且维度只能是低基数字符串、数字或布尔值。它会拒绝常见的个人身份、请求内容和密钥字段。来源表不得包含邮箱、IP、客户或用户标识、请求正文、Token 或原始事件载荷。

## 配置步骤

1. 将本目录复制为独立项目并运行 `npm install`。
2. 在 Dashloom 创建目标产品；进入 **Settings → Extensibility** 创建数据接入密钥，并立即复制保存。
3. 编辑 `wrangler.jsonc`：
   - 将 `DASHLOOM_URL` 替换为 Dashloom 部署的 HTTPS Origin；
   - 将 `DASHLOOM_PRODUCT_ID` 替换为产品 UUID；
   - 设置标准化的 `SOURCE_NAME`；
   - 将 D1 名称和 ID 替换为你自己 Cloudflare 账号中的数据库。
4. 在 D1 中创建聚合数据契约，然后由你的应用写入真实聚合值。SQL 文件刻意不会插入任何示例指标：

   ```bash
   npx wrangler d1 execute YOUR_DATABASE --remote --file source-contract.sql
   ```

5. 把 Dashloom 接入密钥保存为 Worker Secret，不能写进 `wrangler.jsonc`：

   ```bash
   npx wrangler secret put DASHLOOM_API_KEY
   ```

6. 生成 Binding 类型，并在不部署的情况下完成校验：

   ```bash
   npm run types
   npm run check
   ```

7. 使用 `npm run deploy` 部署。默认 Cron 每小时第 7 分钟运行，可按需修改 `triggers.crons`。

## 本地验证

创建不会进入 Git 的 `.dev.vars`，填入本地接入密钥，准备本地 D1 表，然后运行 `npm run dev`。启用 `--test-scheduled` 后，Wrangler 会提供定时任务测试端点。`GET /health` 只返回连接器模式，不返回任何配置或密钥。

结构化日志只包含事件名称、日期范围、行数、计划执行时间或稳定错误代码，不会记录供应商响应正文和凭证。

## 运行行为

- 固定查询只通过 D1 Binding 读取 `dashloom_metrics_daily`。
- 重复发送回看窗口是安全的，Dashloom 会按照工作空间、产品、来源、指标、日期和维度执行 Upsert。
- 任意一行无效都会使整次运行失败，不会悄悄发送不完整证据。
- Dashloom 返回非 2xx 时，Cron 会失败并出现在 Cloudflare Cron 历史中。
- Worker 的公开入口只有 `GET /health`，不存在未鉴权的手动同步接口。
