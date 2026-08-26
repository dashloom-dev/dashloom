# 备份与恢复手册

Dashloom 使用 Cloudflare D1 作为系统事实来源。工作空间 JSON 导出用于客户数据迁移；数据库备份和灾难恢复使用 D1 Export 与 Time Travel。

## 高风险变更之前

1. 使用 `npx wrangler d1 info site-creator-d1 --json` 确认生产数据库名称和 UUID。
2. 导出独立 SQL 副本：

```bash
npx wrangler d1 export site-creator-d1 --remote --output backups/dashloom-YYYY-MM-DD.sql
```

3. 为变更时间记录 Time Travel bookmark：

```bash
npx wrangler d1 time-travel info site-creator-d1 --timestamp 2026-08-26T10:00:00Z --json
```

4. 将导出文件保存在应用部署之外并限制访问。文件可能包含加密凭证、用户标识和客户指标。

## 恢复演练

尽量在独立测试数据库执行恢复演练。生产 Time Travel 恢复会原地覆盖当前数据库。

```bash
npx wrangler d1 time-travel restore site-creator-d1 --bookmark BOOKMARK
```

恢复后：

1. 保存 Cloudflare 返回的 `previous_bookmark`，以便撤销本次恢复。
2. 生产环境执行 `npx wrangler d1 migrations list site-creator-d1 --remote` 检查迁移。
3. 使用 `npx wrangler d1 migrations apply site-creator-d1 --remote` 应用恢复点之后的迁移。
4. 确认没有待执行迁移，并查询 `workspaces`、`workspace_members`、`products`、`metric_points`、`analysis_runs`、`agent_comparison_runs`、`agent_comparison_results`、`reports`、`billing_subscriptions` 等关键表。
5. 验证登录、只读看板、一次连接器同步、一次 Agent 分析和一次报告推送。
6. 记录恢复点、恢复耗时、验证人和缺失数据。

Cloudflare 当前为生产存储子系统提供 Time Travel，支持按 bookmark 或时间恢复，并返回可用于撤销的 `previous_bookmark`。每次生产演练前请核对[最新 D1 Time Travel CLI](https://developers.cloudflare.com/workers/wrangler/commands/d1/)和[恢复 API](https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/restore/)。
