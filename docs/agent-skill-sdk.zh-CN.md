# Agent Skill 清单

Agent Skill 用来把 Dashloom 的五类证据型分析 Agent 适配到具体业务场景。Skill 可以补充分析重点并声明所需指标，但不能读取凭证、执行代码、调用外部工具或覆盖平台的证据规则。

## 安装 Skill

通过 **Marketplace** 可以按服务端解析的 slug 安装随版本发布、经过维护者审核的 Skill。安装自定义清单时，进入 **设置 → 扩展能力**，填写：

- 稳定的小写 slug 和语义化版本号；
- 一个基础分析 Agent；
- 业务流程需要的指标；
- 简洁、明确的领域分析规则。

Owner 和 Admin 可以安装或更新 Skill。每次分析都会把 Skill 的 ID、slug、版本和所需指标写入证据快照；停用的 Skill 不会被加载。

安装时会拒绝重复指标、嵌入网址、试图覆盖平台规则的指令、凭证或隐藏 Prompt 请求，以及外部工具或命令调用。Runner 会再次执行同一策略检查，旧版本遗留的不安全清单会被排除，并作为被拒绝的证据元数据记录。更新已经存在的 slug 必须提高语义化版本号；提交完全相同的清单仍然是幂等操作。每段通过检查的指令都会生成 SHA-256 指纹，分析证据会冻结当次使用的指令正文、指纹、策略版本和所需指标。

```json
{
  "slug": "saas-unit-economics",
  "name": "SaaS Unit Economics",
  "version": "1.0.0",
  "basePreset": "revenue_analyst",
  "requiredMetrics": ["mrr", "churn_rate", "paid_users"],
  "instructions": "优先判断 MRR 增长是否可持续，并标记超过两个百分点的流失率变化。"
}
```

Skill 规则始终从属于 Dashloom 的系统约束：只分析已提供证据，区分事实与假设，不虚构原因或单位，重要结论必须引用 evidence ID。产品名称、域名、连接器标签和导入文本仍被视为不可信数据。

发布 Skill 清单前请运行 `npm test`。契约测试覆盖正常领域规则，以及指令覆盖、凭证读取、外部执行、URL、重复指标、指纹和版本顺序等对抗场景。通过本地检查不代表任何第三方 Marketplace 已经审核或背书该 Skill。
