# 在 Vercel 或 AWS 部署社区版

Dashloom Community 现在有三条真实的运行路径：

- **Cloudflare 原生：**Vinext 运行在 Workers 中，直接使用 `DB` D1 Binding。
- **Vercel 或 AWS 上的 Next.js + Remote D1：**Next.js 运行在 Node.js 中，通过 Cloudflare 鉴权 HTTP API 向 D1 发送参数化 Drizzle 查询。
- **Vercel 或 AWS 上的 Next.js + Supabase：**Next.js 运行在 Node.js 中，通过 PostgreSQL 适配器把完整应用状态存入 Supabase PostgreSQL。

Cloudflare Workers、Vercel 和 AWS 是部署目标，不是业务数据源，因此不会出现在 Dashboard 的数据源目录中。

如需使用原生 Worker 路径，请阅读 [Cloudflare 部署指南](deployment-cloudflare.zh-CN.md)。

## 准备条件

- Node.js 22.13 或更高版本、npm 10 或更高版本
- Vercel 项目、AWS Amplify Hosting 应用或其他兼容 Node.js 的托管环境
- 一个仅供 Community 使用的新 Remote D1 数据库或 Supabase 项目
- 用于认证回调的公开 HTTPS Origin

把仓库连接到托管平台前，先在本地运行 `npm ci` 和 `npm test`。

## 必需的环境变量

把 `node-runtime.env.example` 中的变量配置到目标平台，并始终配置认证、凭据加密和 Cron Secret。然后只选择一种存储后端：

- 语言：设置 `DASHLOOM_DEFAULT_LOCALE=en` 或 `DASHLOOM_DEFAULT_LOCALE=zh-CN`。它决定登录与找回密码的默认语言，以及新工作空间的初始语言。工作空间 Owner 之后仍可切换语言；修改部署变量不会覆盖已有工作空间。
- D1：设置 `DASHLOOM_DATABASE=d1`，并使用只限定目标数据库的专用 Token 配置三个 `CLOUDFLARE_*` 变量。
- Supabase：设置 `DASHLOOM_DATABASE=supabase` 和 `SUPABASE_DATABASE_URL`。Serverless 托管优先使用 Supabase Transaction Pooler 地址。系统默认强制 TLS，并关闭 Prepared Statement 以兼容连接池。

两种后端保存的社区版状态完全一致：Better Auth 用户和会话、工作空间、产品、连接器配置、标准化证据、Agent 对话与运行、行动、任务、报告、计划和审计事件。

## Vercel

导入代码仓库并添加环境变量。仓库中的 `vercel.json` 默认使用 `npm run build:next` 构建 D1 路径。使用 Supabase 时，在项目设置中把构建命令改为 `npm run build:supabase`，或在部署分支修改该文件。不要同时启用两个存储后端。

## AWS Amplify Hosting

在 Amplify Hosting 中连接代码仓库并添加环境变量。现有 `amplify.yml` 通过 `npm run build:next` 使用 D1；选择 Supabase 作为应用存储时，把构建命令改为 `npm run build:supabase`。其他 AWS Next.js 托管方案同样可以使用这两条构建命令和 standalone 输出。

## Node.js 托管平台上的定时任务

Cloudflare Workers 会按照 `wrangler.jsonc` 每 15 分钟执行一次 `worker.ts`。Next.js 部署没有 Worker Scheduled Handler，因此需要由托管平台或外部调度器向以下两个接口发送带认证的 `POST` 请求：

- `/api/cron/maintenance`：处理到期的数据源同步、行动结果和 Growth Mission；
- `/api/cron/reports`：处理到期的报告计划。

请求必须包含 `Authorization: Bearer <REPORT_CRON_SECRET>`，并在部署环境中保存同一个独立 Secret。2xx 响应表示本次自动化没有任务级错误；部分完成或失败情况应在应用自动化台账中检查。不要使用无法添加认证的公开调度器调用这些接口。

## 数据库迁移

启动部署前，必须应用所选后端对应的 Migration；应用构建成功不代表生产数据库结构已经完成迁移。

使用 D1 时，先确认生产数据库名称与 UUID，返回的 UUID 必须与 `CLOUDFLARE_D1_DATABASE_ID` 一致。检查 Migration 状态、应用仓库 Migration、重新检查，并查询同一个数据库中的关键表：

```bash
npx wrangler d1 info dashloom-production --json
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 migrations apply dashloom-production --remote
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 execute dashloom-production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','workspace_members','products','metric_points','analysis_runs','reports') ORDER BY name;"
```

最终 Migration 列表必须没有待执行项，且关键表必须存在。仓库中存在 Migration 文件不代表生产数据库已经完成迁移。

使用 Supabase 时，从目标项目的数据库设置复制连接字符串，只在安全 Shell 或 CI Secret 中设置 `SUPABASE_DATABASE_URL`，然后运行：

```bash
npm run db:migrate:supabase
```

PostgreSQL Migration 位于 `drizzle-supabase/`。开始承载流量前，确认目标 Supabase 项目中 38 张应用表都已存在。数据库 URL 绝不能放入任何 `NEXT_PUBLIC_*` 变量。

## Supabase 运维说明

Supabase 后端现在具备独立的 PostgreSQL Schema、Migration Journal、Better Auth 方言、连接池驱动、带事务的 Batch 适配器和 PostgreSQL JSON 表达式。`npm run typecheck:supabase`、`npm test` 与 `npm run build:supabase` 可在不连接生产数据库的情况下验证这条路径；把 Migration 应用到所选项目并核验结果仍是部署步骤。

可以通过 `SUPABASE_DATABASE_POOL_SIZE` 把每个应用实例限制在 1–20 个连接（默认 `5`）。`SUPABASE_DATABASE_SSL=disable` 只适用于无 TLS 的可信本地或自托管 Supabase；Supabase 托管项目应保留安全默认值。

## 发布核验

正式发布前同时运行两套类型检查和两套生产构建：

```bash
npm run typecheck
npm run typecheck:supabase
npm run build:next
npm run build:supabase
```

随后针对所选后端验证登录、工作空间语言切换、一次连接器同步、一次 Agent 运行，以及两个带认证的 Cron 接口。

## 生产核验与回滚

1. 确认 `BETTER_AUTH_URL` 与最终 HTTPS Origin 一致，并测试登录与找回流程。
2. 创建工作空间，确认所选 `DASHLOOM_DEFAULT_LOCALE` 只应用于新工作空间。
3. 完成一次连接器同步，并确认证据写入所选后端。
4. 使用生产 `REPORT_CRON_SECRET` 调用两个 Cron 接口，并检查自动化台账。
5. 对外宣布可用前测试导出和一次带证据引用的 Agent 运行。

执行高风险 Migration 前先备份所选数据库，具体方式见[备份与恢复指南](backup-and-recovery.zh-CN.md)。如果应用核验失败，把托管部署回滚到上一版本。不要手动删除表或修改 Migration 历史。数据库回滚必须使用经过测试的备份或 Provider 恢复机制，并在恢复后重新执行 Migration 与 Schema 核验。
