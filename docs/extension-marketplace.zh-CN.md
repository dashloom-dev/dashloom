# 扩展 Marketplace

产品内 Marketplace 让用户可以发现 Dashloom 的连接器入口和 Agent Skill 包，同时不会把扩展机制变成不可信的代码执行渠道。

## 当前目录

公开仓库目前提供五个 Agent Skill 包，分别对应五类内置运营分析 Agent：

- 产品组合资源分配雷达；
- SaaS 单位经济分析；
- SEO 内容机会分析；
- Cloudflare 可靠性监控；
- 代理商客户经营简报。

连接器目录覆盖 Cloudflare、Google、收入渠道、交付运维、Custom REST、鉴权数据接入和 Connector SDK。连接器凭证仍然只在服务端使用，并严格限定在所属工作空间。

## 安装与信任边界

只有工作空间 Owner 和 Admin 可以安装目录 Skill。浏览器只提交已发布的 slug，服务端从随版本发布的目录中解析不可由前端修改的清单，再次执行 Schema 与安全策略校验，强制语义化版本单调升级，为指令生成指纹，并把发布者、源码、审核状态和版本写入工作空间审计记录。

后续每次分析仍会把实际使用的 Skill 版本与指令指纹冻结到证据包。Skill 不能读取凭证、执行代码、调用工具、访问网址、覆盖平台规则、扩大 Agent 权限或绕过证据引用。

“维护者已审核”只表示清单公开收录在 Dashloom 仓库并通过当前策略契约，不代表独立安全审计或第三方背书。Marketplace 会链接到公开源码，方便部署者在安装前核对准确内容。

## 发布扩展

按照 [Agent Skill 清单](agent-skill-sdk.zh-CN.md)或 [Connector SDK](connector-sdk.zh-CN.md)编写扩展，补充契约测试，并说明所需指标与权限。Agent Skill 发布者可按照[社区投稿与审核流程](community-extension-submissions.zh-CN.md)提交；连接器目前先通过公开的扩展提案 Issue 发起，再由维护者集成。

Dashloom 明确区分“已提案、已投稿、独立审核、已发布”四种状态。投稿不会自动获得审核，也不会自动出现在 Marketplace。独立审核必须同时具备仓库内审核声明，以及由非发布者、非 PR 作者针对当前 PR 最新提交给出的 GitHub Approve。最终发布仍由维护者明确决定。
