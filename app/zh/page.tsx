import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dashloom — 开源多产品数据控制台',
  description: '在一个开源控制台中统一查看 Cloudflare、Google Analytics、Search Console 和业务指标。',
  alternates: { canonical: '/zh', languages: { en: '/', zh: '/zh', 'x-default': '/' } },
};

const cards = [
  ['产品', '12', '一个工作空间统一管理'],
  ['新增用户', '3,482', '本月增长 18.7%'],
  ['付费用户', '1,245', '本月增长 14.2%'],
  ['收入', '$128.6K', '本月增长 22.4%'],
];

export default function ChineseHome() {
  return <main lang="zh-CN">
    <nav className="site-nav" aria-label="主导航">
      <a className="brand" href="/zh"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></a>
      <div className="nav-links"><a href="#product">产品</a><a href="#why">为什么选择 Dashloom</a><a href="#open-source">开源版本</a></div>
      <div className="nav-actions"><Link className="text-link" href="/">English</Link><a className="text-link" href="https://github.com/dashloom-dev/dashloom">GitHub</a><a className="button button-small" href="#product">查看演示</a></div>
    </nav>
    <section className="hero">
      <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
      <div className="eyebrow"><span />开源 · 自托管 · Cloudflare 原生</div>
      <h1>所有产品信号，<br /><em>尽在一个视图。</em></h1>
      <p className="hero-copy">连接 Cloudflare、Google Analytics、Search Console 和业务指标，快速判断什么正在增长、哪里出现异常，以及下一步应该投入什么。</p>
      <div className="hero-actions"><a className="button" href="https://github.com/dashloom-dev/dashloom">开始自托管 <span>↗</span></a><a className="button button-secondary" href="#product">查看产品界面 <span>↓</span></a></div>
      <p className="hero-note">为同时经营多个产品的独立开发者和小型团队打造。</p>
    </section>
    <section className="zh-dashboard" id="product">
      <header><div><small>工作空间总览</small><h2>早上好，Alex。</h2></div><button>↻ 立即同步</button></header>
      <div className="metric-grid">{cards.map(([label,value,note], index) => <article className={`metric-card ${['mint','blue','violet','amber'][index]}`} key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</div>
      <div className="zh-insights"><article><span>全局趋势</span><strong>2.48M</strong><p>Cloudflare 请求量</p><div className="mini-signal" /></article><article><span>数据源状态</span><strong>4/4</strong><p>全部正常同步</p><div className="source-health"><i /><i /><i /><i /></div></article><article><span>增长最快</span><strong>Nimbus</strong><p>收入增长 20.1%</p><div className="growth-bar"><i /></div></article></div>
    </section>
    <section className="value-section" id="why"><div className="section-intro"><span>为什么选择 DASHLOOM</span><h2>别再用一堆后台<br />管理你的产品。</h2></div><div className="value-grid"><article><b>01</b><h3>看清整个产品组合</h3><p>在一个视图中比较产品健康、获客、搜索表现和收入，不再手动拼接表格。</p></article><article><b>02</b><h3>掌握自己的部署</h3><p>把 Dashloom 部署到自己的 Cloudflare 账号，配置和数据与其他项目完全分离。</p></article><article><b>03</b><h3>及时发现数据异常</h3><p>连接器状态和数据新鲜度让缺失数据清晰可见，避免把同步失败误认为健康的零增长。</p></article></div></section>
    <section className="open-section" id="open-source"><div><span className="eyebrow"><span />公开构建</span><h2>从代码开始，<br />用清晰决策。</h2></div><div className="open-copy"><p>部署社区版本，连接自己的账号并掌控数据。未来的 Dashloom Cloud 会提供托管同步、告警和团队协作，而不会封锁核心体验。</p><a className="button" href="https://github.com/dashloom-dev/dashloom">在 GitHub 查看 <span>↗</span></a></div></section>
    <footer><a className="brand" href="/zh"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></a><p>所有产品信号，尽在一个视图。</p><span>© 2026 Dashloom</span></footer>
  </main>;
}
