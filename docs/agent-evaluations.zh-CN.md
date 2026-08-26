# Agent 质量评测

Dashloom 为产品组合、收入、SEO、运维和 Agency 客户分析提供了一套离线黄金数据集。它与具体模型厂商解耦，维护者可以用同一批业务场景比较 Prompt 或 Provider 变更。

运行仓库内置的参考输出：

```bash
npm run eval:agent
```

如需评测另一个模型的实际输出，请创建一个以场景 ID 为键的 JSON 文件并传入路径：

```bash
npm run eval:agent -- path/to/provider-outputs.json
```

每个输出包含 `summary` 和结构化 `findings`。每条 finding 都要提供 `title`、`detail`、`action`、`confidence` 和 `evidenceRefs`；完整格式可参考 `evals/reference-outputs.json`。

## 评测内容

- 每条结论只能引用当前场景中存在的证据；
- 必须覆盖场景要求的业务信号；
- 必须出现该场景所需的分析概念和行动建议；
- 不能出现无证据的因果或结果承诺；
- relationship 证据只能作为共同变化和待验证假设，不能被表述成因果证明；
- 结论数量与可信度必须符合输出契约；
- 同一条结论不能合并不同币种的金额证据。

任一场景失败时命令会返回非零退出码。仓库内的参考输出只用于验证评测器本身，并不代表某个第三方模型已经通过。有效的 Provider 对比必须同时保存真实输出、模型标识、Prompt 版本、日期和参数。

工作空间内的实时对比请参阅 [Agent Quality Lab](agent-quality-lab.zh-CN.md)。它会向所选的 2–4 个 Provider 发送同一份冻结证据和输出契约，并使用确定性统计展示差异，不让另一个模型充当裁判。
