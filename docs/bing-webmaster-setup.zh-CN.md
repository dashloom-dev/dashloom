# 接入 Bing Webmaster Tools

Dashloom 使用用户级 API Key 接入 Bing Webmaster Tools。一个 Key 可以发现该 Bing Webmaster 账号下有权访问的全部已验证站点。

## 创建 API Key

1. 登录 [Bing Webmaster Tools](https://www.bing.com/webmasters/)。
2. 添加并验证需要由 Dashloom 读取的站点。
3. 打开 **Settings → API Access → API Key**。
4. 生成或复制用户 API Key。

Microsoft 同时支持 OAuth 2.0 和 API Key。Dashloom 使用 API Key，因此自托管部署无需配置全局 Bing OAuth Client。Key 会加密保存、按工作空间隔离，并且不会随工作空间导出返回。

## 连接并映射站点

1. 打开 **Data sources → Bing Search**。
2. 输入连接名称和 Bing Webmaster API Key。
3. Dashloom 验证 Key，并发现全部已验证站点。
4. 当站点域名与某个产品域名唯一匹配时，系统自动建立映射。
5. 使用 **Discovered site** 处理未匹配或有歧义的站点。

只要至少存在一个映射，连接成功后就会自动执行首次同步。后续可以点击 **Sync Bing**，也可以配置自动同步计划。

## 导入的数据

- 每日点击量、展示量和点击率。
- 查询词维度的点击量、展示量和平均排名。
- 页面维度的点击量、展示量和平均排名。

Dashloom 使用 Bing 的 JSON/HTTP 接口。如果在 Bing 中重新生成了 Key，需要在 Dashloom 中重新连接。断开本地连接会删除加密凭据，但无法远程撤销 Bing API Key。
