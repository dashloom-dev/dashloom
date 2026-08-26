# 连接 Cloudflare D1 业务指标

Dashloom 可以把你自己 D1 数据库中的聚合结果转换为标准化产品指标。注册、活跃用户、订阅、收入、退款，以及应用已经保存的其他数字信号都可以通过该连接器接入。

## 1. 创建最小权限 Token

在 Cloudflare 创建自定义 API Token，只为数据库所属账号授予 **Account / D1 / Read** 权限，不要授予写入权限。Token 只需保存一次；Dashloom 会加密存储，并且不会再次显示明文。

在 D1 概览页复制 Account ID 和 Database ID。每个 Dashloom 连接对应一个数据库，同一工作空间可以配置多个连接。

## 2. 编写聚合查询

查询结果必须包含一个 ISO 日期列，以及一个或多个数值列。请限制查询日期范围，避免返回无关历史数据。

```sql
SELECT
  date(created_at) AS metric_date,
  count(*) AS signups,
  sum(case when plan = 'paid' then 1 else 0 end) AS paid_signups
FROM users
WHERE created_at >= datetime('now', '-14 days')
GROUP BY date(created_at)
ORDER BY metric_date
```

把日期结果列设为 `metric_date`，再将查询列映射为稳定的 Dashloom 指标名：

```json
{
  "signups": "signups",
  "paid_signups": "paid_signups"
}
```

指标名只能使用字母、数字和下划线。单个查询最多映射 20 个指标、返回 5,000 行。

## 3. 连接并同步

进入 **Dashboard → Data sources → Business metrics**，选择产品，填写 Token 和 ID，再保存 SQL。点击 **Sync D1 metrics** 会执行当前工作空间内所有已启用的映射。

Dashloom 只接受单条 `SELECT` 或 `WITH` 查询，会拒绝数据修改和 DDL 语法，并检查 D1 响应中的写入行数必须为零。Token 只在服务端校验或同步时解密。

## 常见问题

- **鉴权失败：** 检查 Token 是否拥有目标账号的 D1 Read 权限。
- **日期无效：** 返回 `YYYY-MM-DD`，或前十位符合该格式的时间戳。
- **没有写入指标：** 检查映射列是否为数值，列名是否与 SQL 别名完全一致。
- **返回行数过多：** 按天聚合并缩小查询日期范围。

参考资料：[Cloudflare D1 Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)。
