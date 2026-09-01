# 接入 Stripe 收入证据

Dashloom 可以从一个 Stripe 账号为一个产品导入四类经营数据：每日毛收入、每日退款、当前月度经常性收入（MRR）和当前付费客户数。系统只读取账号默认币种，绝不会把不同币种静默相加。

## 创建受限 Key

进入 **Stripe Dashboard → Developers → API keys → Restricted keys**，创建一个服务端受限 Key，并只开放以下读取权限：

- Account details；
- Balance transactions；
- Subscriptions 和 subscription items。

建议先使用测试环境受限 Key。Stripe 推荐使用最小权限 Restricted Key，不要向第三方提供无限制 Secret Key。Publishable Key 无法读取这些资源。

## 连接与验收

1. 先在 Dashloom 创建产品。
2. 打开 **Data sources → Stripe revenue**。
3. 填写连接名称、选择产品并粘贴 Restricted Key。
4. 点击 **Connect Stripe**。Dashloom 会验证 Account 权限，识别账号 ID 和默认币种，使用绑定工作空间的 AES-GCM 加密 Key，并把账号映射到产品。
5. 点击 **Sync Stripe**，或创建 Stripe 自动同步计划。
6. 打开 **SaaS Revenue Dashboard**，或向 **Revenue Analyst** 询问 MRR、收入、退款和付费客户变化。

重复提交同一 Stripe 账号会轮换加密 Key 并更新产品映射。Dashloom 会限制分页数量、把失败写入同步历史，并且不会通过查询 API 或工作空间导出返回 Key。

## 指标语义

- `revenue`：按日统计的商业毛收入流水；
- `refunds`：按日统计的退款绝对值；
- `mrr`：把日、周、月、年订阅价格归一到月度后得到的当前 active 订阅快照；
- `paid_customers`：active 订阅对应的不重复客户数；
- `trialing_customers`：试用客户数，与付费 MRR 分开保存。

MRR 是某一时点的经营估算，不是财务确认收入。由于无法仅根据价格确定未来月度金额，系统不会计算没有固定单价的计量或阶梯价格。Stripe 手续费、Payout、Transfer、税费、其他币种和无关余额流水也不计入。

官方资料：[Stripe Key 安全](https://docs.stripe.com/keys-best-practices)、[Balance transactions](https://docs.stripe.com/api/balance_transactions/list)和[Subscriptions](https://docs.stripe.com/api/subscriptions/list)。
