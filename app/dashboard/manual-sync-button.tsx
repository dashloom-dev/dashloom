'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react';
import type { ManualSyncTarget } from '@/lib/manual-sync';

export function ManualSyncButton({ targets, zh }: { targets: ManualSyncTarget[]; zh: boolean }) {
  const router = useRouter();
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  async function sync() {
    if (running.current || !targets.length) return;
    running.current = true;
    setPending(true);
    setIssues([]);
    let written = 0;
    let completed = 0;
    const failures: string[] = [];
    try {
      for (const [index, target] of targets.entries()) {
        setMessage((zh ? '正在同步 ' : 'Syncing ') + target.label + ' (' + (index + 1) + '/' + targets.length + ')…');
        try {
          const response = await fetch(target.endpoint, { method: 'POST' });
          const result = await response.json() as { error?: string; written?: number; errors?: string[]; calculated?: { error?: string } };
          if (!response.ok || result.error) throw new Error(result.error || (zh ? '同步失败，请重试。' : 'Sync failed. Please retry.'));
          written += result.written || 0;
          const errors = [...(result.errors || []), ...(result.calculated?.error ? [result.calculated.error] : [])];
          if (errors.length) failures.push(target.label + ': ' + errors.join('; '));
          else completed++;
        } catch (error) {
          failures.push(target.label + ': ' + (error instanceof Error ? error.message : (zh ? '连接失败' : 'Connection failed')));
        }
      }
      setIssues(failures);
      setMessage(zh
        ? `${completed}/${targets.length} 个来源同步完成 · 写入 ${written.toLocaleString('zh-CN')} 条数据${failures.length ? ` · ${failures.length} 个来源需处理` : ''}`
        : `${completed}/${targets.length} sources synced · ${written.toLocaleString('en-US')} points written${failures.length ? ` · ${failures.length} ${failures.length === 1 ? 'source needs' : 'sources need'} attention` : ''}`);
    } finally {
      running.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return <div className="overview-manual-sync">
    <button className="app-secondary" type="button" onClick={sync} disabled={pending || !targets.length} aria-busy={pending} title={!targets.length ? (zh ? '请先连接数据源并配置产品映射，或联系管理员授予同步权限。' : 'Connect a source and map a product, or ask an admin for sync access.') : undefined}>
      <RefreshCw size={16} aria-hidden="true" />
      {pending ? (zh ? '正在同步…' : 'Syncing…') : (zh ? '手动同步数据' : 'Sync data now')}
    </button>
    {message && <section className="overview-sync-feedback" data-tone={pending ? 'pending' : issues.length ? 'warning' : 'success'}>
      <div className="overview-sync-status" role="status">
        {pending ? <RefreshCw size={17} aria-hidden="true" /> : issues.length ? <CircleAlert size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
        <p>{message}</p>
      </div>
      {issues.length > 0 && <details className="overview-sync-details"><summary>{zh ? '查看同步问题' : 'View sync issues'} <span>({issues.length})</span></summary><div><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul><a href="/dashboard/sources">{zh ? '检查数据源配置' : 'Check source settings'} →</a></div></details>}
    </section>}
  </div>;
}
