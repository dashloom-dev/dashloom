import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Dashloom — 开源 AI 产品智能平台',
  description: '连接运营、增长、收入和竞品数据，让专用 Agent 解释变化、提出行动建议并生成定期报告。',
  alternates: { canonical: '/zh', languages: { en: '/', zh: '/zh', 'x-default': '/' } },
  openGraph: { images: [{ url: '/og-zh.png', width: 1200, height: 630, alt: 'Dashloom 开源 AI 产品智能平台' }] },
  twitter: { images: ['/og-zh.png'] },
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
      <a className="brand" href="/zh"><Brand priority /></a>
      <div className="nav-links"><a href="#product">产品</a><a href="#why">为什么选择 Dashloom</a><a href="#open-source">开源版本</a></div>
      <div className="nav-actions"><Link className="text-link" href="/">English</Link><a className="text-link" href="https://github.com/dashloom-dev/dashloom">GitHub</a><a className="button button-small" href="#product">查看演示</a></div>
    </nav>
    <section className="hero">
      <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
      <div className="eyebrow"><span />开源 · AI 驱动 · Cloudflare 原生</div>
      <h1>让所有产品数据，<br /><em>变成下一步行动。</em></h1>
      <p className="hero-copy">连接运营、获客、SEO、收入和竞品数据。Dashloom 的专用 Agent 会解释发生了什么、为什么重要，以及下一步应该做什么。</p>
      <div className="hero-actions"><a className="button" href="https://github.com/dashloom-dev/dashloom">开始自托管 <span>↗</span></a><a className="button button-secondary" href="#product">查看产品界面 <span>↓</span></a></div>
      <p className="hero-note">为同时经营多个产品的独立开发者和小型团队打造。</p>
    </section>
    <section className="zh-dashboard" id="product">
      <header><div><small>工作空间总览</small><h2>早上好，Alex。</h2></div><button>↻ 立即同步</button></header>
      <div className="metric-grid">{cards.map(([label,value,note], index) => <article className={`metric-card ${['mint','blue','violet','amber'][index]}`} key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</div>
      <div className="agent-brief"><div className="agent-orb">AI</div><div><span>产品组合分析 AGENT · 每日简报</span><strong>Nimbus 贡献了本周 61% 的收入增长。</strong><p>3 个页面进入搜索前十带动自然流量增长；Pulse Monitor 的错误率需要关注。查看 4 条带数据证据的分析。</p></div><button>打开分析 →</button></div>
      <div className="zh-insights"><article><span>全局趋势</span><strong>2.48M</strong><p>Cloudflare 请求量</p><div className="mini-signal" /></article><article><span>数据源状态</span><strong>4/4</strong><p>全部正常同步</p><div className="source-health"><i /><i /><i /><i /></div></article><article><span>增长最快</span><strong>Nimbus</strong><p>收入增长 20.1%</p><div className="growth-bar"><i /></div></article></div>
    </section>
    <section className="intelligence-section"><div className="section-intro"><span>五套看板 · 五类专用 AGENT</span><h2>同一份数据，<br />服务不同增长场景。</h2><p>Indie Hacker、SaaS 收入、SEO 增长、Cloudflare 运维和 Agency 客户看板共享统一的数据层。</p></div><div className="intelligence-grid">{[['独立开发者','产品组合分析'],['SaaS 收入','收入分析'],['SEO 增长','搜索增长分析'],['Cloudflare 运维','运维异常分析'],['Agency 客户','客户报告分析']].map(([name,agent],index)=><article key={name}><b>0{index+1}</b><span>{name}看板</span><h3>{agent} Agent</h3><p>根据场景组合指标、变化分析和行动建议。</p><a href="/docs">查看能力 →</a></article>)}</div></section>
    <section className="value-section" id="why"><div className="section-intro"><span>为什么选择 DASHLOOM</span><h2>不只是查看数据，<br />还要理解变化。</h2></div><div className="value-grid"><article><b>01</b><h3>基于证据回答</h3><p>重要结论关联到具体产品、指标、时间范围、来源和数据新鲜度，而不是凭空生成答案。</p></article><article><b>02</b><h3>自动生成定期简报</h3><p>Agent 持续监控数据变化，并生成每日、每周和每月报告，推送到关联渠道。</p></article><article><b>03</b><h3>选择并对比模型</h3><p>开源版可使用自己的 OpenAI 兼容 API，在相同证据上对比 2–4 个模型；云版本另有托管 AI 额度。</p></article></div></section>
    <section className="open-section" id="open-source"><div><span className="eyebrow"><span />开放的智能层</span><h2>使用你的数据，<br />也使用你的模型。</h2></div><div className="open-copy"><p>在自己的基础设施上部署 Dashloom Community，配置 OpenAI 兼容 API 地址、密钥和模型；数据、计划与报告都由你控制。</p><a className="button" href="https://github.com/dashloom-dev/dashloom">在 GitHub 查看 <span>↗</span></a></div></section>
    <footer><a className="brand" href="/zh"><Brand /></a><p>让所有产品数据，变成下一步行动。</p><span className="footer-links"><a href="/docs">文档</a><a href="/status">部署状态</a><a href="/privacy">隐私</a><a href="/terms">条款</a><a href="https://github.com/dashloom-dev/dashloom/security">安全</a><i>© 2026 Dashloom</i></span></footer>
  </main>;
}
