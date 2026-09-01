# Custom REST 指标接入

Custom REST 可以让 Dashloom 定时从你控制的 HTTPS 接口拉取产品 KPI。当内置连接器没有覆盖某项指标，并且你希望使用定时拉取而不是主动调用标准化写入 API 时，可以使用这个入口。

## 1. 提供标准响应

创建一个返回 `application/json` 的 `GET` 接口，并使用版本 1 合约：

```json
{
  "version": 1,
  "truncated": false,
  "metrics": [
    {
      "metric": "trial_signups",
      "date": "2026-08-25",
      "value": 12,
      "unit": "users",
      "domain": "commercial",
      "dimensions": {
        "plan": "studio"
      }
    },
    {
      "metric": "activation_rate",
      "date": "2026-08-25",
      "value": 34.7,
      "unit": "percent"
    }
  ]
}
```

合约规则：

- `metric` 只能使用小写字母、数字和下划线，必须以字母开头，最长 80 个字符；
- `date` 必须是 `YYYY-MM-DD` 格式的真实 UTC 日期；
- 未来日期会被拒绝，避免污染后续对比周期；
- `value` 必须是有限 JSON 数字；
- `unit` 可选，同一指标应保持单位稳定；
- `domain` 可选，用于把未知自定义指标交给对应专项 Agent，可选值为 `commercial`、`acquisition`、`search`、`delivery`、`operations` 或 `product`；
- `dimensions` 可选，键名使用小写格式，最多包含 12 个有界标量；
- 每次响应包含 1–500 条指标，总大小不能超过 1 MiB。
- 如果接口无法返回目标周期的完整数据，把顶层 `truncated` 设为 `true`；Agent 会披露覆盖不完整，而不会把缺失记录当作 0。

请稳定使用 `paid_users`、`subscribers`、`*_rate` 等有明确语义的名称。Dashloom 会先执行确定性汇总，再把证据交给 Agent。

金额指标必须在 Dimensions 中提供三位币种代码，例如 `"dimensions": { "currency": "USD" }`，不要把不同币种合并成一个数值。

## 2. 保护接口

Dashloom 支持三种认证方式：

- 无认证；
- `Authorization: Bearer …`；
- 一个自定义的 `X-…` API Key Header。

建议创建 Dashloom 专用、只读、可单独撤销的凭证，不要复用管理员或数据库凭证。Endpoint URL 不能包含查询参数、Fragment、用户名或密码。

连接器会在每次请求前验证公网 DNS，拒绝私网、保留地址和跳转，并使用 15 秒超时；只接受小于 1 MiB 的 JSON 响应。凭证在服务端加密，不会通过读取 API 或工作空间导出返回。

## 3. 连接并同步

1. 在 **Products** 创建指标所属产品。
2. 打开 **Data sources → Custom REST metrics**。
3. 填写连接名称、产品、Endpoint URL 和认证方式。
4. 点击 **Connect endpoint**。Dashloom 会先调用一次接口并校验合约，成功后才保存连接。
5. 点击 **Sync Custom REST** 写入第一批真实指标。
6. 在 **Automatic synchronization** 中选择 **Custom REST metrics**，再选择当前套餐允许的同步频率。

连接时，一个 Endpoint 会映射到一个产品，同一产品可以连接多个 Endpoint。指标身份包含连接指纹，因此多个自定义来源不会意外覆盖彼此。禁用连接会清除已保存凭证，但保留历史指标数据。成功写入的指标会进入与内置连接器相同的看板、计算指标、告警、报告和 Agent 证据层。

## 故障排查

- **必须使用 HTTPS / 私网地址被拒绝：** 把接口发布在公网 HTTPS 域名；localhost、私网 IP、Link-local 地址以及解析到这些地址的域名都会被拒绝。
- **Contract v1 错误：** 按示例检查响应，并优先修复错误提示中的第一个字段。
- **HTTP 401 或 403：** 轮换专用 Token，或确认自定义 Header 名称和值。
- **响应过大：** 只返回 Dashloom 所需的标准化日级汇总，不要返回原始事件或客户记录。
- **请求超时：** 在自己的服务内预先聚合，使接口能在 15 秒内响应。
- **曾经成功但现在显示 Attention：** 修复接口后手动同步一次；同步成功会恢复 Connected 状态。

Dashloom 不会执行远程响应中的任意脚本、JSONPath 或转换代码。请在你控制的服务内完成数据转换；需要更完整的集成时，可以使用 [Connector SDK](connector-sdk.zh-CN.md)。
