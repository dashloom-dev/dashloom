# 连接 Cloudflare Pages 部署健康

Dashloom 会把 Cloudflare Pages 部署结果接入 Operations Agent 和 Portfolio Agent 的证据。系统只保存部署时间、production/preview 环境、是否跳过、最终阶段结果和派生耗时；不会持久化环境变量、构建配置、Commit Hash 或 Message、分支、仓库身份、部署 URL、Alias、源码、构建日志或部署内容。

## 创建最小权限

1. 打开 **Cloudflare → Manage Account → Account API Tokens**。
2. 创建自定义 Token，只授予账号级 **Cloudflare Pages → Read**（API 权限参考中显示为 **Pages Read**）。
3. 仅包含 Pages 项目所在的 Cloudflare 账号。
4. 复制 Account ID 和准确的 Pages Project Name。

不要授予 Pages Write。Dashloom 不会创建、重试、回滚或删除部署。

## 连接与同步

进入 **Dashboard → Data sources → Cloudflare Pages**，选择 Dashloom 产品，填写 Account ID、准确的 Project Name 和只读 Token 后连接。Pages 使用独立加密凭证，因此同一 Cloudflare 账号的 Pages 最小权限 Token 不会覆盖 Worker 或 R2 Analytics Token。

手动和定时同步会刷新此前 60 天和当天，并标准化：

- 按日统计部署总数、成功、失败、取消、跳过和 Production 部署数；
- 同时存在创建时间和最终阶段结束时间时，计算平均部署耗时；
- 最近一次已完成且未跳过的部署是否成功；
- 距离最近一次未跳过部署的天数。

每个项目最多读取 5 页、500 条部署记录。如果还有更多分页，每个已采集指标都会带 `truncated` 证据标记，Agent 必须披露覆盖不完整。部署耗时不等于用户侧延迟或运行性能。

Cloudflare 的部署响应可能包含敏感的构建与源码元数据。Dashloom 会在标准化时主动丢弃这些字段，不会把它们写入指标、同步错误、审计元数据或 Agent 证据。官方参考：[Get Pages deployments](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/) 和 [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)。

## 故障排查

- **403：**确认 Token 具有账号级 Pages Read，并包含所选账号。
- **404：**确认 Account ID 和准确的 Pages Project Name。
- **没有耗时：**Provider 没有返回有效的最终阶段结束时间；结果数量仍可同步。
- **部分完成：**有超过 500 条部署，只能在实际导入的证据范围内解释。

重复连接同一个 Cloudflare Pages 账号会轮换其加密 Token。
