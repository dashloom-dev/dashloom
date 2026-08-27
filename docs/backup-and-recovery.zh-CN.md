# 备份与恢复手册

Dashloom 会把完整应用状态保存在部署时选择的后端：Cloudflare D1 或 Supabase PostgreSQL。工作空间 JSON 导出用于客户数据迁移，但不是完整的运维备份；必须针对所选数据库单独建立备份与恢复流程。

## Cloudflare D1

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

### D1 恢复演练

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

## Supabase PostgreSQL

执行高风险变更前，确认目标 Supabase 项目，并在 **Database → Backups** 查看实际可用的备份窗口。付费项目提供托管每日备份，Point-in-Time Recovery 需要单独启用；如果当前项目没有所需的托管保留能力，运营方应创建并异地保存逻辑备份。操作前核对 Supabase 当前的[数据库备份说明](https://supabase.com/docs/guides/platform/backups)和[CLI 备份恢复指南](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)。

恢复演练应优先恢复到独立项目。原地恢复期间项目不可用，并会覆盖数据库状态。任何恢复完成后：

1. 使用 `npm run db:migrate:supabase` 重新应用 `drizzle-supabase/` 中更新的 Migration。
2. 确认目标项目中 38 张 Dashloom 应用表全部存在。
3. 确认部署环境的 `SUPABASE_DATABASE_URL` 仍指向恢复后的项目，并且只存在于服务端。
4. 验证登录、一次看板读取、一次连接器同步、一次 Agent 运行和一次报告运行。
5. 记录恢复点、恢复耗时、验证人、缺失数据，以及该恢复方式要求的凭证轮换。

Supabase 数据库备份不包含 Dashloom 外部 Provider 的数据，也不能控制保存在外部系统中的凭证。恢复 Dashloom 不会撤销或回滚 Google、Bing、支付平台等连接系统中的凭证。
