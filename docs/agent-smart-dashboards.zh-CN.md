# Agent 智能看板

Dashloom 可以把任意一次成功的 Agent 分析转成可复用智能看板，把证据、专业分析、看板、行动项和自动报告连接起来，同时不允许模型编造图表数据。

## 创建智能看板

1. 接入真实产品数据，并配置 BYOK 或托管模型。
2. 打开 **Agent**，选择五类专家之一并运行分析。
3. 检查带证据引用的结论，然后点击 **Create smart dashboard**。
4. Dashloom 会根据对应决策模板打开已保存视图。

针对同一分析重复创建时会返回原有看板，不会产生重复数据。

## Agent 可以决定什么

所选专家决定基础看板：

- Portfolio Analyst → Indie Hacker Dashboard；
- Revenue Analyst → SaaS Revenue Dashboard；
- SEO Growth Analyst → SEO Growth Dashboard；
- Operations Analyst → Cloudflare Operations Dashboard；
- Client Reporting Analyst → Agency Client Dashboard。

结论中合法的指标名称会优先进入看板，随后补充安全的模板默认指标，总数不超过八个。只有当每一条结论都带产品范围且全部指向同一产品时，Dashloom 才会自动限定为单产品视图；否则保持产品组合范围。

## 证据行为

Agent 简报是绑定准确成功分析运行的历史结论。结论卡片保留置信度、下一步行动和证据引用。指标卡与证据表则持续读取工作空间中的最新标准化数据，用户可以清楚区分历史判断和当前变化。

**Inspect frozen evidence** 会打开模型当时使用的不可变证据快照。如果数据保留策略以后删除了该分析，普通看板仍然可用，但不再显示 Agent 简报。

## 分享边界

私密看板链接只公开所选产品范围、标准化指标和当前指标证据，刻意排除内部 Agent 简报，因为自然语言摘要可能提及保存范围之外的工作空间信息。需要向客户发送经过检查的叙事内容时，应使用客户报告。
