# Agent Quality Lab

Dashloom 的 Agent Quality Lab 会让 2—4 个已经连接的 OpenAI 兼容 Provider 分析完全相同的一份冻结工作空间证据。对比期间不会改变事实、Agent 角色、已安装 Skill 版本、Prompt 合约或输出上限，适合选择实际使用的 Provider 和模型。

## 发起对比

1. 在 **Settings → Bring your own model** 中连接至少两个已验证 Provider。Owner 和 Admin 可以随时禁用 Provider；禁用会永久删除保存的加密凭证，但保留历史结果快照。
2. 同步真实产品数据。
3. 进入 **Agent → Agent Quality Lab**。
4. 选择分析 Agent、勾选 2—4 个 Provider，填写同一个决策问题并开始对比。

每个 Provider 都会收到相同的有界证据和问题，并独立运行。单个 Provider 失败时，对比会标记为部分完成，不会删除其他 Provider 的成功结果。

## 版本化与保留内容

每次对比都会保存：

- 本次分析保存的数据快照和准确的对比周期；
- Agent 预设、问题、Prompt 版本，以及冻结的 Agent Skill 版本和指令 Hash；
- Provider 显示名称、模式和模型快照，不暴露 API Key；
- 仅保留通过 Schema 与引用验证的结论；
- 输入/输出 Token、观察到的请求耗时、结论与严重程度数量、可执行项数量、模型自报平均置信度和引用的 Evidence ID。

未通过验证的 Provider 原文不会保存。BYOK 与 Managed 调用仍会进入只追加的用量账本。Managed 对比开始前必须有足够的当日剩余额度覆盖全部选中 Provider。

## 如何理解结果

Dashloom 使用两组 Evidence ID 的 Jaccard 重合度计算“引用证据一致度”，它回答的是“模型是否关注了相同事实”，不能证明相似表达一定正确；重合度低也不自动意味着某个 Provider 更差。

Quality Lab 不让一个 LLM 给另一个 LLM 打分，也不生成含糊的综合冠军分。更换生产模型前，应同时审查引用有效性、证据选择、行动建议质量、耗时、Token 和多次版本化运行的稳定性。

## 权限与隐私

只有工作空间 Owner 和 Admin 可以发起对比，因为一次任务会产生多次外部模型调用；Member 可以查看已保存的结果。生产 Agent 使用的有界证据、Prompt Injection 防护、币种隔离、截断披露、关系假设标记和引用校验规则会原样应用于每个 Provider。
