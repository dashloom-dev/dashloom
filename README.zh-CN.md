<p align="center">
  <img src="public/favicon.svg" width="72" alt="Dashloom Logo" />
</p>

<h1 align="center">Dashloom</h1>

<p align="center">所有产品信号，尽在一个视图。</p>

<p align="center"><a href="README.md">English</a> · <a href="https://dashloom.dev/zh">网站</a> · <a href="https://dashloom.dev/docs">文档</a></p>

Dashloom 是一个开源、Cloudflare 原生的多产品运营控制台，面向同时经营多个产品的独立开发者和小型团队。它将逐步把 Cloudflare Workers Analytics、Google Analytics 4、Google Search Console 和产品业务指标汇总到一个工作空间中。

![Dashloom 社交预览](public/og.png)

## 当前里程碑

仓库当前包含：

- 英文产品首页和中文本地化入口
- 使用虚构数据的多产品控制台预览
- 兼容 Cloudflare 的 Vinext 运行时
- 面向多租户的 D1 与 Drizzle 数据模型
- canonical、多语言 sitemap、robots 和社交分享信息

Cloudflare/Google 授权、定时同步和公开账号注册属于下一个开发阶段。在凭证处理、校验、重试和测试完成之前，项目不会把这些能力描述成已完成集成。

## 本地开发

需要 Node.js 22.13 或更新版本以及 npm。

```bash
npm install
npm run dev
```

打开开发服务器输出的本地地址即可。

## 验证

```bash
npm run typecheck
npm run lint
npm run build
npm run db:generate
```

## 架构边界

- 产品界面只调用稳定的服务端接口，不掌管授权或凭证真值。
- 产品、连接器、指标和同步任务都必须属于明确的工作空间。
- 凭证只保存在服务端，进入持久化之前必须加密。
- 第三方 Provider ID 不作为产品核心身份。
- 外部连接器启用前，同步写入必须具备幂等性。

## 许可证

[MIT](LICENSE)
