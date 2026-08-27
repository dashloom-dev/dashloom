# 在 Vercel 或 AWS 部署社区版

Dashloom Community 现在有三条真实的运行路径：

- **Cloudflare 原生：**Vinext 运行在 Workers 中，直接使用 `DB` D1 Binding。
- **Vercel 或 AWS 上的 Next.js + Remote D1：**Next.js 运行在 Node.js 中，通过 Cloudflare 鉴权 HTTP API 向 D1 发送参数化 Drizzle 查询。
- **Vercel 或 AWS 上的 Next.js + Supabase：**Next.js 运行在 Node.js 中，通过 PostgreSQL 适配器把完整应用状态存入 Supabase PostgreSQL。

Cloudflare Workers、Vercel 和 AWS 是部署目标，不是业务数据源，因此不会出现在 Dashboard 的数据源目录中。

## 必需的环境变量

把 `node-runtime.env.example` 中的变量配置到目标平台，并始终配置认证、凭据加密和 Cron Secret。然后只选择一种存储后端：

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

D1 使用 Wrangler，并验证目标远程数据库没有待应用 Migration。Supabase 则从数据库设置复制连接字符串，只在安全 Shell 或 CI Secret 中设置 `SUPABASE_DATABASE_URL`，然后运行：

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
