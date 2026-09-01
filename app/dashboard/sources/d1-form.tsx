'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GuidedMetricSuggestion } from '@/lib/business-data-discovery';
import { BusinessConnectionSteps, BusinessDiscoveryFields, businessCurrencies, selectedGuidedMappings } from './business-discovery-fields';

const sampleSql = `SELECT
  date(created_at) AS metric_date,
  count(*) AS signups
FROM users
WHERE created_at >= datetime('now', '-14 days')
GROUP BY date(created_at)
ORDER BY metric_date`;

export function D1Form({ products, zh = false }: { products: Array<{ id: string; name: string }>; zh?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<GuidedMetricSuggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);

  async function discover(form: FormData, refreshed = false) {
    setPending(true); setMessage(zh ? '正在读取 D1 表结构并识别业务字段…' : 'Reading the D1 schema and identifying business fields…');
    const response = await fetch('/api/connectors/d1/discover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: form.get('accountId'), databaseId: form.get('databaseId'), apiToken: form.get('apiToken') }) });
    const result = await response.json() as { error?: string; suggestions?: GuidedMetricSuggestion[] };
    setPending(false);
    if (!response.ok || !result.suggestions) { setMessage(d1ErrorMessage(result.error, zh)); return false; }
    setSuggestions(result.suggestions);
    setSelected(Object.fromEntries(result.suggestions.flatMap((item) => item.options[0] ? [[item.metric, item.options[0].reason]] : [])));
    setMessage(refreshed
      ? (zh ? '识别规则或数据库结构已更新。请确认新的字段结果后再次预览并同步。' : 'Discovery rules or the database schema changed. Confirm the refreshed fields, then preview and sync again.')
      : (zh ? '自动识别完成。请确认字段后预览并同步。' : 'Discovery complete. Confirm the fields, then preview and sync.'));
    return true;
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!suggestions.length && !advanced) {
      await discover(form);
      return;
    }
    let metrics: Record<string, string> | undefined;
    if (advanced) {
      try { metrics = JSON.parse(String(form.get('metrics'))) as Record<string, string>; }
      catch { setMessage(zh ? '高级指标映射格式不正确。' : 'Advanced metric mapping must be valid JSON.'); return; }
    }
    const guidedMappings = advanced ? undefined : selectedGuidedMappings(suggestions, selected);
    if (!advanced && !guidedMappings?.length) { setMessage(zh ? '至少确认一个业务指标。' : 'Confirm at least one business metric.'); return; }
    setPending(true); setMessage(zh ? '正在验证、连接并同步 D1…' : 'Validating, connecting, and synchronizing D1…');
    const shared = { displayName: form.get('displayName'), accountId: form.get('accountId'), databaseId: form.get('databaseId'), apiToken: form.get('apiToken'), productId: form.get('productId'), currency: form.get('currency') };
    const payload = advanced
      ? { ...shared, sql: form.get('sql'), dateColumn: form.get('dateColumn'), metrics }
      : { ...shared, guidedMappings };
    const response = await fetch('/api/connectors/d1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setPending(false);
      if (/no longer available/i.test(result.error || '')) { await discover(form, true); return; }
      setMessage(d1ErrorMessage(result.error, zh)); return;
    }
    await sync();
  }
  async function sync() {
    setPending(true); setMessage(zh ? '正在运行已配置的只读查询…' : 'Running configured read-only queries…');
    const response = await fetch('/api/sync/d1', { method: 'POST' });
    const result = await response.json() as { error?: string; written?: number };
    setPending(false); setMessage(result.error || (zh ? `已同步 ${result.written || 0} 条 D1 业务指标数据。` : `${result.written || 0} D1 business metric points synchronized.`));
    if (response.ok) router.refresh();
  }
  const activeStep: 1 | 2 | 3 | 4 = pending ? (suggestions.length ? 4 : 2) : suggestions.length ? 3 : 1;
  return <form className="connector-form d1-form guided-connector" onSubmit={connect}>
    <header className="guided-connector-head"><span>{zh ? '持续同步' : 'ONGOING SYNC'}</span><h3>{zh ? '连接 D1 后，Dashloom 会自动导入最新业务数据' : 'Connect D1 to keep business data up to date'}</h3><p>{zh ? '如果只想快速导入一份表格，请使用“快速导入”；此处适合已经使用 Cloudflare D1 的用户。' : 'Use Quick import for a one-off spreadsheet. This connection is for teams already using Cloudflare D1.'}</p></header>
    <BusinessConnectionSteps active={activeStep} zh={zh} />
    <div className="settings-grid" hidden={suggestions.length > 0 && !advanced}><label>{zh ? '连接名称' : 'Connection name'}<input name="displayName" required placeholder={zh ? '生产业务数据库' : 'Production business database'} /></label><label>{zh ? '导入到产品' : 'Import into product'}<select name="productId" required disabled={!products.length}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>{zh ? 'Cloudflare 账户 ID' : 'Cloudflare account ID'}<input name="accountId" required minLength={20} placeholder={zh ? '在 Cloudflare 控制台复制账户 ID' : 'Copy the Account ID from Cloudflare'} /></label><label>{zh ? 'D1 数据库 ID' : 'D1 database ID'}<input name="databaseId" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label><label>{zh ? 'D1 只读令牌' : 'D1 read-only token'}<input name="apiToken" required type="password" autoComplete="new-password" minLength={20} placeholder={zh ? '仅授予 D1 Read 权限' : 'Grant D1 Read only'} /></label><label>{zh ? '收入币种' : 'Revenue currency'}<select name="currency" defaultValue={businessCurrencies[0]}>{businessCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></label></div>
    {suggestions.length > 0 && <BusinessDiscoveryFields suggestions={suggestions} selected={selected} onSelect={(metric, reason) => setSelected((current) => ({ ...current, [metric]: reason }))} sourceLabel="Cloudflare D1" zh={zh} />}
    <details className="advanced-settings"><summary>{suggestions.length ? (zh ? '高级设置' : 'Advanced settings') : (zh ? '开发者高级设置：SQL 与指标映射' : 'Developer advanced settings: SQL and metric mapping')}</summary><div><label className="advanced-mode-toggle"><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} /> {zh ? '使用自定义 SQL，跳过自动识别' : 'Use custom SQL and skip discovery'}</label><label>{zh ? '日期列' : 'Date result column'}<input name="dateColumn" defaultValue="metric_date" /></label><label>{zh ? '只读汇总查询' : 'Read-only aggregate query'}<textarea name="sql" defaultValue={sampleSql} rows={9} /></label><label>{zh ? '指标映射（查询列 → Dashloom 指标）' : 'Metric mapping (query column → Dashloom metric)'}<textarea name="metrics" defaultValue={'{"signups":"signups"}'} rows={3} /></label></div></details>
    <footer><small>{zh ? '自动识别只读取数据库结构；确认后才读取聚合结果并写入 Dashloom。' : 'Discovery reads schema metadata only. Aggregates are read after you confirm the mapping.'}</small><div>{suggestions.length > 0 && <button className="app-secondary" type="button" disabled={pending} onClick={() => { setSuggestions([]); setSelected({}); }}>{zh ? '上一步' : 'Back'}</button>}{suggestions.length === 0 && <button className="app-secondary" type="button" disabled={pending} onClick={sync}>{zh ? '同步已有连接' : 'Sync existing connection'}</button>}<button className="app-primary" disabled={pending || !products.length}>{pending ? (zh ? '处理中…' : 'Working…') : suggestions.length || advanced ? (zh ? '预览并同步' : 'Preview & sync') : (zh ? '连接并自动识别' : 'Connect & discover')}</button></div></footer>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}

function d1ErrorMessage(error: string | undefined, zh: boolean) {
  if (!error) return zh ? '未能识别 D1 业务字段。' : 'D1 business discovery failed.';
  if (/SQLITE_AUTH|not authorized/i.test(error)) return zh
    ? 'Cloudflare 拒绝读取 D1 结构。请确认令牌包含 Account / D1 / Read，并且账户 ID 与数据库 ID 属于同一账户。'
    : 'Cloudflare denied D1 schema access. Confirm the token has Account / D1 / Read and the Account ID owns this database.';
  return error;
}
