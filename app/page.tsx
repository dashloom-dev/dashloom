import { Brand, BrandMark } from '@/components/brand';

const metrics = [
  { label: 'Products', value: '12', note: 'Across one workspace', tone: 'mint' },
  { label: 'New users', value: '3,482', note: '+18.7% this month', tone: 'blue' },
  { label: 'Paying users', value: '1,245', note: '+14.2% this month', tone: 'violet' },
  { label: 'Revenue', value: '$128.6K', note: '+22.4% this month', tone: 'amber' },
];

const products = [
  ['Nimbus Analytics', 'Analytics', '28,410', '$52.7K', '2.48M'],
  ['Pulse Monitor', 'Monitoring', '19,832', '$31.4K', '1.92M'],
  ['Flow Builder', 'Automation', '14,562', '$18.6K', '1.37M'],
  ['Signal CRM', 'CRM', '11,903', '$14.2K', '932K'],
];

const sources = ['Cloudflare Workers', 'Google Analytics 4', 'Search Console', 'Bing Webmaster', 'Stripe revenue', 'D1 metrics'];

const intelligenceViews = [
  ['Indie Hacker', 'Portfolio Analyst', 'Products, traffic, revenue, and operations'],
  ['SaaS Revenue', 'Revenue Analyst', 'MRR, churn, retention, and expansion'],
  ['SEO Growth', 'SEO Growth Analyst', 'Queries, pages, rankings, and competitors'],
  ['Cloudflare Operations', 'Operations Analyst', 'Requests, errors, latency, Workers, and D1'],
  ['Agency Client', 'Client Reporting Analyst', 'Client KPIs, anomalies, and recurring delivery'],
];

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Dashloom home">
          <Brand priority />
        </a>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#why">Why Dashloom</a>
          <a href="#open-source">Open source</a>
        </div>
        <div className="nav-actions">
          <a className="text-link" href="/zh" lang="zh-CN">中文</a>
          <a className="text-link" href="https://github.com/dashloom-dev/dashloom">GitHub</a>
          <a className="button button-small" href="/login">Open Dashloom</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="eyebrow"><span />Open source · AI-powered · Cloudflare-native</div>
        <h1>Turn every product signal<br /><em>into your next move.</em></h1>
        <p className="hero-copy">Connect operations, acquisition, search, revenue, and competitor data. Dashloom&apos;s specialized agents explain what changed, why it matters, and what to do next.</p>
        <div className="hero-actions">
          <a className="button" href="https://github.com/dashloom-dev/dashloom">Start self-hosting <span>↗</span></a>
          <a className="button button-secondary" href="/login">Open the product <span>→</span></a>
        </div>
        <p className="hero-note">Built for indie hackers and small teams running multiple products.</p>
      </section>

      <section className="product-stage" id="preview" aria-label="Dashloom dashboard preview">
        <div className="window-bar">
          <div className="window-dots"><span /><span /><span /></div>
          <div className="window-address">app.dashloom.dev/overview</div>
          <span className="window-status"><i /> All systems synced</span>
        </div>
        <div className="app-shell">
          <aside className="app-sidebar">
            <div className="app-brand"><BrandMark compact /><strong>Dashloom</strong></div>
            <small>WORKSPACE</small>
            <a className="active" href="#preview"><span>⌘</span>Overview</a>
            <a href="#preview"><span>◷</span>Lifetime</a>
            <a href="#preview"><span>◇</span>Products</a>
            <a href="#preview"><span>◉</span>Data sources</a>
            <a href="#preview"><span>⚙</span>Settings</a>
            <div className="workspace-person"><b>AM</b><span><strong>Acme Studio</strong><small>12 products</small></span></div>
          </aside>

          <div className="dashboard">
            <header className="dashboard-head">
              <div><p>Workspace overview</p><h2>Good morning, Alex.</h2></div>
              <div className="dashboard-actions"><button>Last 30 days⌄</button><button className="sync">↻ Sync now</button></div>
            </header>
            <div className="metric-grid">
              {metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
            </div>
            <div className="agent-brief">
              <div className="agent-orb">AI</div>
              <div><span>PORTFOLIO ANALYST · DAILY BRIEF</span><strong>Nimbus is driving 61% of this week&apos;s revenue growth.</strong><p>Search traffic rose after three pages entered the top 10, while Pulse Monitor&apos;s error rate needs attention. Review 4 evidence-linked findings.</p></div>
              <button>Open analysis →</button>
            </div>
            <div className="trend-card">
              <div className="card-heading"><div><h3>Global trend</h3><p>Core metrics across every product</p></div><div className="legend"><span className="mint-dot" />Requests <span className="blue-dot" />Users <span className="violet-dot" />Clicks</div></div>
              <div className="chart" aria-label="Sample product metrics chart">
                <span className="chart-label top">200K</span><span className="chart-label middle">100K</span><span className="chart-label bottom">0</span>
                <div className="grid-line line-one" /><div className="grid-line line-two" /><div className="grid-line line-three" />
                <div className="area area-mint" /><div className="area area-blue" /><div className="area area-violet" />
                <div className="chart-dates"><span>Jul 27</span><span>Aug 3</span><span>Aug 10</span><span>Aug 17</span><span>Aug 25</span></div>
              </div>
            </div>
            <div className="table-card" id="product">
              <div className="card-heading"><div><h3>Product performance</h3><p>Users, revenue, and traffic at a glance</p></div><a href="#product">View all ↗</a></div>
              <div className="product-table" role="table" aria-label="Sample product performance">
                <div className="product-row product-row-head" role="row"><span>Product</span><span>Category</span><span>Users</span><span>Revenue</span><span>Requests</span><span>Status</span></div>
                {products.map((product) => <div className="product-row" role="row" key={product[0]}><span className="product-name"><i>{product[0][0]}</i><strong>{product[0]}</strong></span><span>{product[1]}</span><span>{product[2]}</span><span>{product[3]}</span><span>{product[4]}</span><span className="live"><i />Live</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="source-strip" aria-label="Supported data sources"><p>One operating layer for</p><div>{sources.map((source) => <span key={source}><i />{source}</span>)}</div></section>

      <section className="intelligence-section" id="intelligence">
        <div className="section-intro"><span>FIVE VIEWS · SPECIALIZED AGENTS</span><h2>One data layer.<br />Five ways to grow.</h2><p>Start with the dashboard that matches your operating model. Enable more views without importing the same data twice.</p></div>
        <div className="intelligence-grid">{intelligenceViews.map(([name, agent, copy], index) => <article key={name}><b>0{index + 1}</b><span>{name} Dashboard</span><h3>{agent}</h3><p>{copy}</p><a href="/docs">Explore capability →</a></article>)}</div>
      </section>

      <section className="value-section" id="why">
        <div className="section-intro"><span>WHY DASHLOOM</span><h2>Go beyond seeing data.<br />Understand what changed.</h2></div>
        <div className="value-grid">
          <article><b>01</b><h3>Ask with evidence</h3><p>Every important answer links back to products, metrics, periods, sources, and data freshness—not a confident guess.</p></article>
          <article><b>02</b><h3>Wake up to the brief</h3><p>Agents monitor changes and prepare daily, weekly, and monthly reports for email, Slack, Discord, or webhooks.</p></article>
          <article><b>03</b><h3>Choose and compare models</h3><p>Connect your own OpenAI-compatible APIs and compare 2–4 models on identical evidence inside your deployment.</p></article>
        </div>
      </section>

      <section className="open-section" id="open-source">
        <div><span className="eyebrow"><span />Open intelligence layer</span><h2>Bring your data.<br />Bring your model.</h2></div>
        <div className="open-copy"><p>Deploy Dashloom Community on your own infrastructure and connect an OpenAI-compatible API endpoint, key, and model. Data, schedules, and reports remain under your control.</p><a className="button" href="https://github.com/dashloom-dev/dashloom">View on GitHub <span>↗</span></a></div>
      </section>

      <footer><a className="brand" href="#top"><Brand /></a><p>Turn every product signal into your next move.</p><span className="footer-links"><a href="/docs">Docs</a><a href="/status">Deployment status</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="https://github.com/dashloom-dev/dashloom/security">Security</a><i>© 2026 Dashloom</i></span></footer>
    </main>
  );
}
