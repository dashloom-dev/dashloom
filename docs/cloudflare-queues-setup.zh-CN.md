# Cloudflare Queues 配置

> 兼容性说明：当前 Community 控制台不再把基础设施服务作为新的业务数据源。代码仍保留已有自托管映射和 API 路由以兼容旧部署。

Dashloom 会采集经过隐私最小化的 Queue 运维快照：近似积压消息数、积压字节数、最老未确认消息的等待时长，以及投递是否暂停。它不会读取、Peek、Pull、确认、重试、清空、发送或保存任何消息。

## 创建最小权限 Token

1. 在 Cloudflare 打开 **My Profile → API Tokens → Create Token → Create Custom Token**。
2. 添加账号级权限 **Queues: Read**，不要授予 Queues Write。
3. 把 **Account Resources** 限制到 Queue 所属账号。
4. 创建 Token，并只复制保存一次。

从 Cloudflare 控制台或只读 Queue 列表复制 Account ID 和 Queue ID。在 Dashloom 打开 **数据源 → Cloudflare Queues**，选择产品，填写账号 ID、Queue ID、连接名称和 Token。

Dashloom 会先验证 Queue 身份和 Metrics 接口，再加密保存 Token。Cloudflare Queues 使用独立连接账号，不会与权限范围更大的 Workers、R2 或 Pages 凭证混用。

## 证据语义

Cloudflare 明确说明实时 Queue 指标属于 Best Effort 近似值。Dashloom 会把该限制写入每条证据，并把四项数值都作为“最新状态”而不是可累加的每日总量。同一天多次同步时，当天序列保留最近一次快照。

Operations Agent 和产品健康分数可以提示投递暂停、大量积压或消息等待过久。这些信号只代表队列压力，不证明原因。修改生产配置前，应继续检查消费者健康、重试设置、死信队列行为和 Cloudflare 当前状态。

验证失败时，请确认 Token 包含目标账号的 **Queues: Read** 权限、Queue ID 属于该账号，并且 Queue 尚未删除。权限变化后，可以在统一连接账号控制中轮换或擦除 Token。
