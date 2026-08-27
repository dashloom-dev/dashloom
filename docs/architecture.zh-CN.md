# Dashloom Community 架构

Dashloom Community 是一个独立应用，与 Dashloom Cloud 不存在运行时、构建、Package、源码、数据库或 Git 依赖。

## 依赖方向

```text
产品界面 -> 认证服务端路由 -> 工作空间服务
         -> 确定性证据 -> BYOK Agent 编排
         -> 存储边界（D1 或 Supabase PostgreSQL）与 Provider 适配器
```

浏览器不会证明工作空间授权、解密凭证、授予模型访问权限或提供可信证据。每次工作空间查询都在服务端解析成员身份。Provider 内容和导入标签均视为不可信数据。

## 运行时与存储选择

仓库支持三种在构建时确定的运行路径：

- Vinext 运行于 Cloudflare Workers，使用原生 `DB` D1 Binding；
- Next.js 运行于 Node.js 托管平台，使用参数化 Remote D1 HTTP 适配器；
- Next.js 运行于 Node.js 托管平台，使用带连接池的 Supabase PostgreSQL 适配器。

`DASHLOOM_DATABASE` 用于选择 Node.js 存储后端。构建别名会在构建前替换数据库驱动、Schema、Better Auth 方言和 JSON 表达式；运行中的实例不会按请求切换数据库。D1 和 PostgreSQL 保持相同的应用表与字段模型，多语句操作则在共享数据库边界后分别使用 D1 Batch 或 PostgreSQL Transaction。

部署平台与应用存储不是产品证据来源。只有明确连接或导入的业务、获客、搜索、收入和运维聚合数据会进入 `metric_points`。

## 数据所有权

- Better Auth 拥有用户、Session、账号、验证与密码恢复数据。
- 工作空间拥有产品、连接器映射、标准化指标、计算指标、竞品、看板、Agent、报告、计划、导入 Key 和审计事件。
- 产品拥有限定产品范围的证据、目标、对话、行动、Growth Mission 和计划。
- 连接器与 BYOK 凭证在服务端加密，并从可迁移导出中排除。

## Community 版本不变量

- AI 执行必须使用已验证且属于当前工作空间的 BYOK Provider。
- 自动同步和报告在运营方自己的 Worker 中执行，或通过 Node.js 托管平台上的认证 Cron 路由执行。
- 报告保存在所选应用数据库中；Community 运行时不包含托管投递渠道。
- 工作空间导出只包含可迁移产品证据，并移除凭证、身份、角色、模型历史和运维 Secret。
- Stripe 在本版本中是只读收入连接器，不用于 Dashloom 订阅计费。

历史 Migration 可能包含仓库拆分前存在的表。Community 运行时代码不会暴露或依赖已退役的 Cloud 能力；保留迁移历史是为了兼容已有自托管升级路径。

D1 与 PostgreSQL Schema 导出相同的 38 张表和应用字段名称。业务服务保持方言无关，只有存储边界拥有数据库专属行为。

只有把匹配的 Migration 应用到目标远程数据库并核验最终 Schema 对象后，生产数据库工作才算完成。D1 还必须确认 Wrangler 没有待执行 Migration；Supabase 必须确认目标项目中 38 张应用表全部存在。
