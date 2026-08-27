# Supabase 运维数据连接教程

> 兼容性说明：Supabase PostgreSQL 现在是应用存储选项，不是当前 Community 控制台中的业务数据源。代码仍保留已有 Management API 映射以兼容旧部署。

Dashloom 通过 Supabase Management API 导入项目状态和按日聚合的请求量。系统只保存 Auth、Realtime、REST、Storage、总 API 请求数，以及 `1`/`0` 项目健康信号；不会读取业务表、Auth 用户、日志、API Key、项目 Secret、SQL、请求路径或请求内容。

## 创建最小权限凭据

1. 优先使用 Supabase OAuth 或细粒度 Token，不要优先使用个人 PAT。
2. 只为要连接的项目授予 `projects_read` 和 `analytics_usage_read`。
3. 如果当前账号还不能创建细粒度 Token，可以使用 PAT，但 PAT 会继承创建者的用户权限，必须将其视为高价值 Secret，定期轮换并在停用时撤销。
4. 在 **Project Settings → General** 复制由 20 个小写字母组成的 Project Ref。

连接器只会访问固定的 `https://api.supabase.com`，并且只调用 `GET /v1/projects/{ref}` 与 `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts?interval=1day`。Token 会先经过权限验证，再加密保存。

## 连接和同步

1. 在 Dashloom 打开 **数据源 → Supabase operations**。
2. 选择该 Supabase 项目对应的 Dashloom 产品。
3. 填写连接名称、Project Ref 和 Access Token。
4. 点击 **Connect Supabase**，然后点击 **Sync Supabase**。
5. 如需保持证据更新，在 **Automation** 中创建 Supabase 同步计划。

每个 Project Ref 都是独立、工作空间隔离的连接账号，因此同一工作空间可以把多个 Supabase 项目分别映射到不同产品。重新连接同一 Ref 会更新它的加密 Token 和产品映射。

可读取的历史范围由 Supabase Management API 决定，Dashloom 会保存接口返回的全部有效日数据。只有 Supabase 返回 `ACTIVE_HEALTHY` 时才记为健康 `1`；其他状态或未知状态均记为 `0`，Operations Agent 可以据此提醒，但不能捏造故障原因。

官方参考：[Management API 鉴权](https://supabase.com/docs/reference/api/introduction)、[项目读取接口](https://supabase.com/docs/reference/api/v1-get-a-project)和[API 用量接口](https://supabase.com/docs/reference/api/v1-get-project-usage-api-count)。
