# 接入 GitHub 仓库活跃度

> 兼容性说明：当前 Community 控制台不再把代码托管活动作为新的业务数据源。代码仍保留已有自托管映射和 API 路由以兼容旧部署。

Dashloom 会把仓库交付数据关联到已经包含流量、收入、SEO 和运行指标的同一个产品。系统只读取汇总元数据、近期 Commit 和已发布 Release，不保存源码、Commit 消息、文件内容或作者身份。

## 创建细粒度 Token

1. 打开 **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**。
2. 只选择需要进入当前 Dashloom 工作空间的仓库。
3. 把 **Repository permissions → Metadata** 设为只读。
4. 把 **Repository permissions → Contents** 设为只读；GitHub 的 Commit 与 Release 接口需要这项权限。
5. 不要授予写入、管理、组织、Issue 或 Pull Request 权限。
6. 设置过期时间并妥善复制 Token。

## 连接与映射

进入 **Dashboard → 数据源 → GitHub 产品活跃度**，选择一个 Dashloom 产品，填写 `owner/repository` 和 Token，然后连接。使用另一个 GitHub 身份重复操作会创建新的账号；同一身份映射其他产品时会安全复用已加密的账号连接。

点击 **同步 GitHub**，或创建 GitHub 自动同步计划。Dashloom 会导入：

- Star、Fork、Watcher、仓库大小、归档状态和距离最近 Push 的天数；
- GitHub 仓库摘要提供的当前开放 Issue 与 Pull Request 合计；
- 最近 30 天的每日 Commit 数和已发布 Release 数。

每个仓库每次同步最多读取 300 条 Commit。达到上限时，同步响应会明确标记为截断，不会把不完整数量伪装成完整结果。

## 故障排查

- **404：** Token 无权访问所选仓库，或仓库名错误。
- **401：** Token 无效或已过期。
- **403/429：** 等待返回的 GitHub 速率限制重置时间后再重试。
- **没有 Commit：** 空仓库可能返回冲突状态，Dashloom 会把它视为合法的零 Commit 状态。

需要轮换 Token 时，重新连接同一个 GitHub 身份即可；新的加密凭证会替换当前工作空间中的旧值。
