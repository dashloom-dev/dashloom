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

const sources = ['Cloudflare Workers', 'Google Analytics 4', 'Search Console', 'D1 metrics'];

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Dashloom home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Dashloom</span>
        </a>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#why">Why Dashloom</a>
          <a href="#open-source">Open source</a>
        </div>
        <div className="nav-actions">
          <a className="text-link" href="/zh" lang="zh-CN">中文</a>
          <a className="text-link" href="https://github.com/dashloom-dev/dashloom">GitHub</a>
          <a className="button button-small" href="#preview">View demo</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="eyebrow"><span />Open source · Self-hosted · Cloudflare-native</div>
        <h1>Every product signal,<br /><em>in one view.</em></h1>
        <p className="hero-copy">Connect Cloudflare, Google Analytics, Search Console, and your business metrics. Know what is growing, what is breaking, and where to focus next.</p>
        <div className="hero-actions">
          <a className="button" href="https://github.com/dashloom-dev/dashloom">Start self-hosting <span>↗</span></a>
          <a className="button button-secondary" href="#preview">Explore the dashboard <span>↓</span></a>
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
            <div className="app-brand"><span className="brand-mark small" aria-hidden="true"><i /><i /><i /></span><strong>Dashloom</strong></div>
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

      <section className="value-section" id="why">
        <div className="section-intro"><span>WHY DASHLOOM</span><h2>Stop running your products<br />from a pile of tabs.</h2></div>
        <div className="value-grid">
          <article><b>01</b><h3>See the whole portfolio</h3><p>Compare product health, acquisition, search visibility, and revenue without stitching together spreadsheets.</p></article>
          <article><b>02</b><h3>Own the deployment</h3><p>Run Dashloom in your Cloudflare account. Your configuration stays separate from anyone else&apos;s project.</p></article>
          <article><b>03</b><h3>Act before numbers drift</h3><p>Connector health and freshness make missing data visible, so silence never looks like a healthy zero.</p></article>
        </div>
      </section>

      <section className="open-section" id="open-source">
        <div><span className="eyebrow"><span />Built in public</span><h2>Start with the code.<br />Stay for the clarity.</h2></div>
        <div className="open-copy"><p>Deploy the community edition, connect your own accounts, and keep control of your data. Dashloom Cloud will add managed sync, alerts, and team workflows—not lock away the core experience.</p><a className="button" href="https://github.com/dashloom-dev/dashloom">View on GitHub <span>↗</span></a></div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></a><p>Every product signal, in one view.</p><span>© 2026 Dashloom</span></footer>
    </main>
  );
}
