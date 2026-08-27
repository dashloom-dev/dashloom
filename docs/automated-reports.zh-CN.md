# 自托管报告

社区用户可以按需生成带证据引用的报告，或建立日、周、月计划。计划任务使用工作空间连接的 BYOK 模型，保持产品 Scope，并以稳定的执行身份安全重试。

Cloudflare 部署通过 Worker 计划任务处理到期报告。Node.js 部署需要配置调度器，向 `/api/cron/reports` 发送带 `Authorization: Bearer <REPORT_CRON_SECRET>` 的 `POST` 请求。

报告保存在所选应用数据库中。本仓库不包含托管邮件、Slack、Discord、Telegram、Webhook 推送或托管告警。
