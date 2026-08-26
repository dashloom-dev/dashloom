# Agent Growth Missions（增长任务）

Growth Mission 把一条带证据链接的 Agent 建议变成经过用户确认、可以衡量的工作。每个 Mission 会冻结产品、指标、数据源、币种、基线日期、基线值、目标值、负责人和截止日期。后续真实产品数据进入后即可更新进度，不需要再次消耗 AI 对话额度。

## 启动 Mission

1. 同步真实产品数据，并运行匹配的 Dashloom Agent。
2. 打开 **Agent actions**，找到一条产品级建议。
3. 展开 **Launch a measurable growth mission**。
4. 填写假设，选择提升或降低目标，设置截止日期，并可分配给工作空间成员。
5. 前往 **Growth missions** 核对冻结基线和自动计算的目标值。

同一次行动出现记录只能启动一个 Mission。如果同一建议随着新证据再次出现，行动出现次数会增加，用户可以启动新的 Mission 周期，同时保留之前的学习记录。

## 测量规则

Dashloom 沿用来源 Agent 运行中的准确指标身份，包括数据源和币种边界。流量型和比率型指标使用启动前最近一个完整 UTC 日；存量指标可以使用启动当日。基线为零时不能创建百分比目标，避免生成没有意义的进度。

每次定时数据同步之后，Dashloom 会查找相同指标身份的后续观测值：

- 截止日期前达到目标：**achieved**；
- 正在朝目标移动：**on track**；
- 正在远离目标：**off track**；
- 截止后仍未达到目标：**missed**；
- 截止时没有新的可比证据：**insufficient**。

用户也可以在 Missions 页面手动刷新。更新同时校验工作空间和 active 状态，已经取消或完成的 Mission 不会被过期任务覆盖。

## 重新进入 Agent 证据链

进行中和近期结束的 Mission 会以 `mission:<id>` 进入后续 Agent 的冻结证据包。Agent 可以引用目标和实际进度，但 Mission 标题与假设始终按不可信数据处理。系统规则要求明确披露非因果边界：Mission 启动后的指标变化不能证明由该行动导致。

Mission 的创建、取消、分配、来源、测量和状态都按工作空间隔离。Owner、Admin 和 Member 可以操作，Viewer 只读。客户安全的工作空间导出包含 Mission 历史，但不会包含模型或连接器凭证。
