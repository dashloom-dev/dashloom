# 准备 Google Analytics 与 Search Console 权限

Dashloom 的 Google 连接器使用 OAuth 2.0，由每位用户授权自己的 Google 账号。不要创建公共服务账号，也不要把 Refresh Token 写入仓库。

## 启用 API

在 [Google Cloud Console](https://console.cloud.google.com/) 创建或选择项目，然后启用：

- Google Analytics Data API
- Google Analytics Admin API
- Search Console API

Admin API 用于发现 GA4 Property 和 Web Stream，Data API 用于读取指标，Search Console API 用于发现站点并读取搜索表现。

## 配置 OAuth consent screen

1. 打开项目的 **Google Auth Platform**。
2. 把 Dashloom 的公开部署地址添加为应用主页。
3. 面向公众的生产应用需要提供可访问的隐私政策和服务条款链接。
4. 只有全部用户都属于同一 Google Workspace 组织时才选择 **Internal**，否则选择 **External**。
5. 只申请两个只读 Scope：
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`

Search Console 私有数据必须使用 OAuth 2.0，官方[授权指南](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)列出了只读 Scope。

Testing 模式适合开发，但非基础 Scope 的授权会在 7 天后失效；Google 在 [Manage App Audience](https://support.google.com/cloud/answer/15549945) 中说明了这一限制。

## 创建 Web application Client

1. 打开 **APIs & Services → Credentials → Create credentials → OAuth client ID**。
2. 选择 **Web application**。
3. 添加完全一致的生产回调地址：

   ```text
   https://YOUR_DASHLOOM_DOMAIN/api/connectors/google/callback
   ```

4. 仅在本地开发时添加：

   ```text
   http://localhost:3000/api/connectors/google/callback
   ```

5. 把 Client ID 和 Client Secret 存入部署平台的密钥管理，不要提交到 Git。

运行时变量名称为：

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

Dashloom 使用 `BETTER_AUTH_URL` 作为生成回调地址的可信公开 Origin，它必须与 Google 中登记的 Origin 完全一致。

## 连接并映射资源

1. 打开 **Data sources → Google Acquisition**。
2. 点击 **Connect Google account**，同意两个只读数据 Scope。
3. Dashloom 会发现 GA4 Property、GA4 Web Stream 域名和 Search Console 站点。
4. 如果资源域名与某个产品唯一匹配，系统会自动完成映射。
5. 使用 **Discovered resource** 处理未匹配或有歧义的资源。
6. 点击 **Sync Google**，导入 14 天 GA4 与 Search Console 证据。

可以使用另一个 Google 身份重复 OAuth 流程。账号、发现资源、映射、加密 Refresh Token 和同步记录都会隔离在当前工作空间中。

公开、多用户部署在把 consent screen 切换为生产前，应完成 Google 要求的验证。自托管私有实例可以使用各自独立的 Google Cloud 项目和 OAuth Client。
