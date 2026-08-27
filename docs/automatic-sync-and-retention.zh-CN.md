# 自动同步

所有部署路径都使用同一套工作空间级同步执行器。任务会在调用 Provider 前进行条件 Claim，记录稳定的重试状态，并按照工作空间配置推进；失败任务使用有上限的指数退避。

Cloudflare 部署由 Worker Scheduled Handler 每 15 分钟运行。Vercel、AWS 或其他 Node.js 托管平台需要配置调度器，向 `/api/cron/maintenance` 发送带 `Authorization: Bearer <REPORT_CRON_SECRET>` 的 `POST` 请求。该接口会处理到期的数据源同步、行动结果和 Growth Mission。

连接器凭证会加密保存在所选应用数据库（D1 或 Supabase PostgreSQL）中。数据保留由自托管运营方的备份与数据库策略决定；本仓库不提供托管保留服务。
