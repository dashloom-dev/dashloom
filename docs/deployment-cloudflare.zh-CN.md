# 在 Cloudflare 部署 Dashloom Community

这条路径使用 Vinext 将 Dashloom 运行在 Cloudflare Workers，并通过名为 `DB` 的原生 D1 Binding 保存完整应用状态。`worker.ts` 的 Scheduled Handler 会按照仓库中的 `wrangler.jsonc` 每 15 分钟运行一次。

请创建仅供 Community 使用的新 D1 数据库，不要把本仓库连接到 Dashloom Cloud 或预发布版本的数据库。

## 准备条件

- Node.js 22.13 或更高版本、npm 10 或更高版本
- 具备 Workers 和 D1 创建权限的 Cloudflare 账号
- Wrangler 登录状态（`npx wrangler login`）或等效的 CI API Token
- 用于 `BETTER_AUTH_URL` 的公开应用域名

克隆并安装项目：

```bash
git clone https://github.com/dashloom-dev/dashloom.git
cd dashloom
npm ci
```

## 1. 创建并绑定生产 D1 数据库

创建一个由你管理的数据库：

```bash
npx wrangler d1 create dashloom-production
```

把返回的数据库名称和 UUID 填入 `wrangler.jsonc` 现有的 `d1_databases` 配置，并保持 Binding 名称和 Migration 目录不变：

```json
{
  "binding": "DB",
  "database_name": "dashloom-production",
  "database_id": "YOUR-D1-DATABASE-UUID",
  "migrations_dir": "./drizzle"
}
```

执行任何生产迁移前，先确认 Wrangler 解析到的是目标数据库：

```bash
npx wrangler d1 info dashloom-production --json
```

输出的 UUID 必须与 `wrangler.jsonc` 中的 `database_id` 一致。

## 2. 选择部署语言

在 `wrangler.jsonc` 的 `vars` 中设置非 Secret 变量 `DASHLOOM_DEFAULT_LOCALE`：

```json
"vars": {
  "DASHLOOM_DEFAULT_LOCALE": "zh-CN"
}
```

使用 `en` 选择英文，使用 `zh-CN` 选择简体中文。它决定登录与找回邮件的初始语言，以及新建工作空间的默认语言。工作空间 Owner 之后仍可切换语言；修改部署变量不会覆盖已有工作空间。

## 3. 配置生产 Secret

为认证、凭证加密和 Cron 认证分别生成独立随机值，然后使用 Wrangler 保存：

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put CREDENTIALS_ENCRYPTION_KEY
npx wrangler secret put REPORT_CRON_SECRET
```

`BETTER_AUTH_URL` 必须是最终 HTTPS Origin，例如 `https://dashloom.example.com`。`BETTER_AUTH_SECRET` 与 `CREDENTIALS_ENCRYPTION_KEY` 都必须至少 32 个字符，并且不能复用同一个值。

只在启用对应功能时添加以下 Secret：

```bash
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put AUTH_EMAIL_WEBHOOK_URL
npx wrangler secret put AUTH_EMAIL_WEBHOOK_SECRET
```

不要把真实 Secret 写入 `.dev.vars`、`wrangler.jsonc`、Git 历史或任何 `NEXT_PUBLIC_*` 变量。只有在生产邮件中继测试通过后，才设置 `AUTH_REQUIRE_EMAIL_VERIFICATION=true`。

## 4. 应用并核验远程 Migration

对准确的生产数据库先检查待执行 Migration，再应用并重新检查：

```bash
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 migrations apply dashloom-production --remote
npx wrangler d1 migrations list dashloom-production --remote
```

最终结果必须没有待执行 Migration。随后查询同一个远程数据库，确认关键应用表存在：

```bash
npx wrangler d1 execute dashloom-production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','workspace_members','products','metric_points','analysis_runs','reports') ORDER BY name;"
```

`drizzle/` 中存在 Migration 文件只代表迁移输入已经打包。只有确认目标数据库 UUID、远程应用全部 Migration、没有待执行项且关键表存在后，生产迁移才算完成。

## 5. 构建并部署

发布前验证 Worker Bundle：

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

仓库内的 Cron Trigger 会让 `worker.ts` 每 15 分钟运行，因此这条路径不需要额外调度器。首次部署后可以绑定自定义域名；标准 Origin 发生变化时，必须同步更新 `BETTER_AUTH_URL`。

## 6. 验证生产部署

在部署域名完成以下检查：

1. 注册或登录账号，并确认使用所选部署语言。
2. 确认新工作空间使用该语言，且工作空间之间仍保持隔离。
3. 添加一个产品并完成一次连接器同步。
4. 添加 OpenAI 兼容的 BYOK 模型，并运行一次带证据引用的 Agent 分析。
5. 创建到期的同步或报告计划，确认 Worker Cron 记录了本次执行。
6. 在启用强制邮件验证前测试导出和密码找回。

## 升级与回滚

高风险升级前，按照[备份与恢复指南](backup-and-recovery.zh-CN.md)备份目标 D1，并记录 Time Travel Bookmark。切换流量到新版 Worker 前先应用新 Migration。

如果应用核验失败，重新部署上一版 Worker。不要通过删除表或修改 Migration 历史来反向迁移数据库。只有使用经过确认的备份或 Time Travel Bookmark 恢复数据库后，才能重新执行 Migration 与 Schema 核验。

## 常见问题

- **找不到 `DB` Binding：**Binding 名称必须严格保持为 `DB`，并检查 `wrangler.jsonc` 中的数据库 UUID。
- **认证跳转到错误域名：**把 `BETTER_AUTH_URL` 更新为最终 HTTPS Origin 后重新部署。
- **界面初始语言不正确：**`DASHLOOM_DEFAULT_LOCALE` 只能使用 `en` 或 `zh-CN`；已有工作空间偏好不会被覆盖。
- **定时任务没有运行：**确认已部署的 Worker 包含 Cron Trigger，并在自动化台账中检查任务级失败。
- **部署后缺少数据表：**停止继续切换流量，核对数据库 UUID，重新检查远程 Migration，并且只应用仓库提供的迁移集合。

如需把 Cloudflare 分析数据作为业务数据源接入，请阅读独立的 [Cloudflare 连接器兼容指南](cloudflare-setup.zh-CN.md)。把 Dashloom 部署在 Cloudflare 上不会自动连接 Cloudflare 分析数据。
