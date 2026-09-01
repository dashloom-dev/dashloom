# 社区 Agent Skill 投稿

Dashloom 通过“来源可核验优先”的流程接收公开 Agent Skill。该流程让源码、许可证、权限、审核身份和被审核的准确提交都可核验，但不会把仓库元数据包装成安全保证。

## 投稿状态

1. **已提案**：Issue 说明用户决策、所需证据、数据访问和权限边界。
2. **已投稿**：PR 新增有效的 `extensions/community/<slug>/submission.json`，并绑定公开仓库与不可变源码提交。
3. **独立审核**：符合条件的审核者检查该源码提交，添加 `review.json`，并在 GitHub 对当前 PR 最新提交执行 Approve。
4. **已发布**：维护者完成策略、来源、测试和产品匹配检查后，明确把不可变清单加入 Marketplace 目录。

四种状态不能混用。合并、审核和 Marketplace 发布是彼此独立的决定。

## 发布者流程

1. 创建 **Community extension proposal** Issue。
2. Fork 仓库，根据 `extensions/community/submission.example.json` 创建 `extensions/community/<slug>/submission.json`。
3. 将 `source.commit` 固定为包含待审核 Skill 源码的 40 位完整提交 SHA；不能用分支或标签代替来源凭据。
4. 记录公开源码仓库、许可证、所需指标、指令和权限边界。不得加入凭证、个人配置、客户数据或密钥。
5. 运行 `npm run validate:extensions`、`npm test` 及项目常规检查。
6. 创建 PR。发布者不得自行添加 `review.json`，也不得声称完成了独立审核。

当前自动化社区契约只接受受限的 Agent Skill 清单。连接器可以先通过 Issue 模板提案，但在独立沙箱化连接器契约完成前，连接器代码仍由维护者集成。

## 独立审核者流程

审核者的 GitHub 身份必须同时区别于发布者和 PR 作者，并检查准确的 `source.commit`，包括：

- 发布者与源码仓库身份；
- 许可证与分发权利；
- 请求的数据、指标和权限边界；
- 指令是否符合 Agent Skill 策略；
- 是否不存在索取凭证、任意代码执行、工具调用、网址访问和指令覆盖；
- 契约测试与声明行为。

审核完成后，根据示例添加 `extensions/community/<slug>/review.json`，填写当前 PR 编号和准确源码提交，然后对当前 PR 最新提交执行 **Approve**。此后如果新增任何提交，必须重新审核。

## 自动验证

本地与 CI 会校验投稿 Schema、目录与 slug 一致性、源码来源、清单策略、审核 Schema、准确源码提交及身份独立性。PR 中的 CI 还会查询 GitHub Review，确认审核声明中的用户确实批准了当前最新提交。

仓库管理员应在 `main` 分支保护规则中强制要求 CI 和 PR Review。绕过分支保护直接推送，无法提供同等级别的独立审核保证。

## 信任边界

“独立审核”只证明某个具名审核者针对准确提交完成了公开检查清单，不代表安全认证、质量担保或背书。Dashloom Skill 仍是声明式扩展：不能执行代码、读取凭证、调用工具、访问网址、扩大 Agent 权限、覆盖平台规则或绕过数据引用。
