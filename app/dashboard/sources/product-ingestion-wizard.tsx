'use client';

import { FormEvent, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

type Product = { id: string; name: string };
type Status = {
  product: Product;
  source: string | null;
  evidence: { pointCount: number; metricCount: number; latestMetricDate: string | null; lastCollectedAt: string | null };
  keyHealth: { activeKeys: number; productScopedKeys: number; lastUsedAt: string | null };
  agentReadiness: Record<string, { ready: boolean; evidencePoints: number }>;
};

export function ProductIngestionWizard({ products, canManage, zh }: { products: Product[]; canManage: boolean; zh: boolean }) {
  const first = products[0];
  const [productId, setProductId] = useState(first?.id || '');
  const [keyName, setKeyName] = useState(first ? `${first.name} ${zh ? '生产环境' : 'production'}` : (zh ? '生产数据导入' : 'Production ingestion'));
  const [source, setSource] = useState('custom');
  const [metric, setMetric] = useState('active_users');
  const [domain, setDomain] = useState('product');
  const [metricDate, setMetricDate] = useState(() => new Date().toISOString().slice(0, 10));
  const origin = useSyncExternalStore(() => () => undefined, () => window.location.origin, () => 'https://your-dashloom.example');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const payload = useMemo(() => JSON.stringify({ rows: [{ productId: productId || 'PRODUCT_UUID', source, metric, metricDate, value: 'YOUR_REAL_AGGREGATE_VALUE', dimensions: { domain } }] }, null, 2).replace('"YOUR_REAL_AGGREGATE_VALUE"', 'YOUR_REAL_AGGREGATE_VALUE'), [domain, metric, metricDate, productId, source]);
  const command = `curl "${origin}/api/ingest/v1/metrics" \\\n  -H "Authorization: Bearer \$DASHLOOM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data '${payload}'`;

  function chooseProduct(id: string) {
    const product = products.find((item) => item.id === id);
    setProductId(id); setKeyName(product ? `${product.name} ${zh ? '生产环境' : 'production'}` : (zh ? '生产数据导入' : 'Production ingestion')); setSecret(''); setStatus(null); setMessage('');
  }
  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setSecret(''); setMessage('');
    const response = await fetch('/api/ingestion-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: keyName, productId }) });
    const result = await response.json() as { error?: string; key?: { token: string } };
    setPending(false); setMessage(result.error || (zh ? '产品级密钥已创建，请立即复制；Dashloom 之后无法再次显示。' : 'Product-scoped key created. Copy it now; Dashloom cannot show it again.'));
    if (result.key) setSecret(result.key.token);
  }
  async function verify() {
    setPending(true); setMessage(zh ? '正在检查已保存的数据和密钥使用情况…' : 'Checking saved data and key usage…');
    const response = await fetch(`/api/ingestion-status?productId=${encodeURIComponent(productId)}&source=${encodeURIComponent(source)}`, { cache: 'no-store' });
    const result = await response.json() as Status & { error?: string };
    setPending(false); setMessage(result.error || (result.evidence.pointCount ? (zh ? '已找到该产品和数据源的数据。' : 'Data found for this product and source.') : (zh ? '尚无匹配数据。请运行服务端发送程序后再次检查。' : 'No matching data yet. Run your server-side sender, then check again.')));
    if (response.ok) setStatus(result);
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(zh ? `${label}已复制。` : `${label} copied.`); }
    catch { setMessage(zh ? `无法复制${label}，请手动选择并复制。` : `Could not copy ${label.toLowerCase()}; select it manually.`); }
  }

  if (!products.length) return <section className="app-panel ingestion-wizard"><div className="panel-empty"><p>{zh ? '请先添加一个真实产品。Dashloom 不会创建演示产品，也不会把示例指标混入你的工作空间。' : 'Add a real product first. Dashloom will not create demo products or mix sample metrics into your workspace.'}</p><Link href="/dashboard/products">{zh ? '添加产品 →' : 'Add product →'}</Link></div></section>;
  const readyAgents = status ? Object.values(status.agentReadiness).filter((item) => item.ready).length : 0;
  return <section className="app-panel ingestion-wizard">
    <div className="panel-title"><div><span>{zh ? '直接导入产品数据' : 'DIRECT PRODUCT INGESTION'}</span><h2>{zh ? '三步接入真实产品' : 'Connect a real product in three steps'}</h2></div><span className="status-pill">{zh ? '仅可写入 · 产品级范围' : 'write only · product scoped'}</span></div>
    <div className="ingestion-steps">
      <form onSubmit={createKey}><header><b>1</b><div><h3>{zh ? '选择范围并创建密钥' : 'Choose scope and create a key'}</h3><p>{zh ? '新密钥只能为所选产品写入指标。' : 'The new secret can write metrics only for the selected product.'}</p></div></header><label>{zh ? '产品' : 'Product'}<select value={productId} onChange={(event) => chooseProduct(event.target.value)}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>{zh ? '密钥名称' : 'Key name'}<input value={keyName} onChange={(event) => setKeyName(event.target.value)} required minLength={2} maxLength={80} /></label><button className="app-primary" disabled={!canManage || pending}>{pending ? (zh ? '处理中…' : 'Working…') : (zh ? '创建产品密钥' : 'Create product key')}</button>{!canManage && <small>{zh ? '只有所有者或管理员可以创建密钥。' : 'Owner or Admin access is required to create a key.'}</small>}</form>
      <div><header><b>2</b><div><h3>{zh ? '发送汇总数据' : 'Send your aggregate'}</h3><p>{zh ? '请将密钥保存在服务端，并用产品的真实汇总值替换示例中的数值占位符。' : 'Keep the secret server-side. Replace the value placeholder with a real aggregate from your product.'}</p></div></header><div className="ingestion-fields"><label>{zh ? '来源' : 'Source'}<input value={source} onChange={(event) => setSource(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40))} pattern="[a-z][a-z0-9_-]{1,39}" /></label><label>{zh ? '指标' : 'Metric'}<input value={metric} onChange={(event) => setMetric(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 80))} pattern="[a-z][a-z0-9_]{1,79}" /></label><label>{zh ? '领域' : 'Domain'}<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="product">{zh ? '产品' : 'Product'}</option><option value="commercial">{zh ? '商业' : 'Commercial'}</option><option value="acquisition">{zh ? '获客' : 'Acquisition'}</option><option value="search">{zh ? '搜索' : 'Search'}</option><option value="delivery">{zh ? '交付' : 'Delivery'}</option><option value="operations">{zh ? '运维' : 'Operations'}</option></select></label><label>{zh ? '指标日期' : 'Metric date'}<input type="date" value={metricDate} onChange={(event) => setMetricDate(event.target.value)} /></label></div>{secret && <div className="ingestion-secret"><strong>{zh ? '密钥仅显示一次' : 'Copy secret once'}</strong><input readOnly value={secret} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => copy(secret, zh ? '密钥' : 'Secret')}>{zh ? '复制' : 'Copy'}</button></div>}<pre><code>{command}</code></pre><button className="app-secondary" type="button" onClick={() => copy(command, zh ? '命令' : 'Command')}>{zh ? '复制命令' : 'Copy command'}</button>
      </div>
      <div><header><b>3</b><div><h3>{zh ? '检查导入的数据' : 'Check imported data'}</h3><p>{zh ? 'Dashloom 会检查已保存的数据点、密钥使用情况，以及哪些报告已经可以生成。不会自动插入测试数据。' : 'Dashloom checks saved data points, key usage, and which reports are ready. It does not add test data.'}</p></div></header><button className="app-primary" type="button" disabled={pending} onClick={verify}>{pending ? (zh ? '检查中…' : 'Checking…') : (zh ? '检查连接' : 'Check connection')}</button>{status && <dl><div><dt>{zh ? '匹配数据点' : 'Matching points'}</dt><dd>{status.evidence.pointCount}</dd></div><div><dt>{zh ? '指标数' : 'Metrics'}</dt><dd>{status.evidence.metricCount}</dd></div><div><dt>{zh ? '最新数据日期' : 'Latest source date'}</dt><dd>{status.evidence.latestMetricDate || (zh ? '等待中' : 'Waiting')}</dd></div><div><dt>{zh ? '产品密钥' : 'Product keys'}</dt><dd>{status.keyHealth.productScopedKeys}</dd></div><div><dt>{zh ? '可生成报告' : 'Reports ready'}</dt><dd>{readyAgents} / 5</dd></div></dl>}</div>
    </div>{message && <p className="form-message" role="status">{message}</p>}
  </section>;
}
