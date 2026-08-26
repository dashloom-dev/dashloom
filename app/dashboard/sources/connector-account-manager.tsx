'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AccountView = { id: string; provider: string; providerName: string; displayName: string; status: string; health: 'healthy' | 'needs_attention' | 'setup' | 'disconnected'; diagnosis: string; repairChecks: string[]; repairHref: string; lastCheckedAt: string | null; mappingCount: number; lastRunStatus: string | null; lastRunAt: string | null; lastErrorCode: string | null };

export function ConnectorAccountManager({ accounts, canManage }: { accounts: AccountView[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  async function disconnect(account: AccountView) {
    if (!window.confirm(`Disconnect ${account.displayName}? Dashloom will permanently remove its stored credential and stop ${account.mappingCount} active mapping${account.mappingCount === 1 ? '' : 's'}. Historical aggregate metrics remain available.`)) return;
    setPending(account.id);
    setMessage('');
    const response = await fetch(`/api/connectors/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
    const result = await response.json() as { error?: string };
    setPending(null);
    setMessage(result.error || `${account.displayName} disconnected. Revoke the original key in ${account.providerName} as an additional provider-side safeguard.`);
    if (response.ok) router.refresh();
  }
  return <section className="app-panel connector-account-manager"><div className="panel-title"><div><span>ACCOUNT CONTROL</span><h2>Connected accounts and credential lifecycle</h2></div><b>{accounts.filter((account) => account.health === 'healthy').length} healthy · {accounts.filter((account) => account.health === 'needs_attention').length} need attention</b></div><div className="connector-account-list">{accounts.map((account) => <div className="connector-account-item" key={account.id}><article className="report-row report-row-action"><div><strong>{account.displayName}</strong><small>{account.providerName} · {account.mappingCount} active mapping{account.mappingCount === 1 ? '' : 's'} · {account.lastRunAt ? `last sync ${new Date(account.lastRunAt).toLocaleString()}` : account.lastCheckedAt ? `checked ${new Date(account.lastCheckedAt).toLocaleString()}` : 'not checked'}</small></div><span>{account.providerName}</span><b data-status={account.health === 'healthy' ? 'connected' : account.health === 'disconnected' ? 'disabled' : 'attention'}>{account.health.replaceAll('_', ' ')}</b><button type="button" className="report-deliver" disabled={!canManage || account.status === 'disabled' || pending === account.id} onClick={() => disconnect(account)}>{pending === account.id ? 'Disconnecting…' : account.status === 'disabled' ? 'Credential removed' : 'Disconnect'}</button></article>{account.health !== 'healthy' && <details className="connector-repair" open={account.health === 'needs_attention'}><summary>Diagnosis and repair</summary><p>{account.diagnosis}</p><ol>{account.repairChecks.map((check) => <li key={check}>{check}</li>)}</ol><a href={account.repairHref}>Review {account.providerName} setup ↑</a></details>}</div>)}{!accounts.length && <div className="panel-empty"><p>No connector account exists yet. Choose a provider below and validate a real credential.</p></div>}</div><footer><small>{message || 'Diagnostics expose stable status and error codes only. Provider responses and stored credentials are never rendered in the browser.'}</small></footer></section>;
}
