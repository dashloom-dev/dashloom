import Link from 'next/link';
import { ArrowRight, Bot, ChevronDown, ListTodo } from 'lucide-react';

type OverviewAnalysis = { id: string; summary: string; action: string | null; createdAt: string };
type OverviewAction = { id: string; title: string; recommendedAction: string; severity: string; status: string; occurrenceCount: number };

export function OverviewReport({ analysis, empty, zh }: { analysis: OverviewAnalysis | null; empty: boolean; zh: boolean }) {
  return <section className="overview-report" aria-labelledby="overview-report-heading">
    <header className="overview-section-heading">
      <div className="overview-section-title"><i><Bot size={20} aria-hidden="true" /></i><h2 id="overview-report-heading">{zh ? '最新报告' : 'Latest report'}</h2>{analysis && <time dateTime={analysis.createdAt}>{analysis.createdAt.slice(0, 10)}</time>}</div>
      <Link href={analysis ? `/dashboard/agent/runs/${analysis.id}` : '/dashboard/agent'}>{analysis ? (zh ? '查看报告' : 'View report') : (zh ? '生成报告' : 'Create report')}<ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
    {analysis ? <details className="overview-report-summary">
      <summary aria-label={zh ? '展开或收起报告摘要' : 'Expand or collapse report summary'}><span className="overview-summary-text">{analysis.summary}</span><span className="overview-summary-toggle"><span className="when-closed">{zh ? '展开摘要' : 'Expand summary'}</span><span className="when-open">{zh ? '收起摘要' : 'Collapse summary'}</span><ChevronDown size={14} aria-hidden="true" /></span></summary>
    </details> : <p className="overview-report-empty">{empty ? (zh ? '还没有报告。先添加产品并连接一个数据源。' : 'No report yet. Add a product and connect a data source to get started.') : (zh ? '第一份报告会显示在这里。导入两个可对比周期的数据后，即可生成报告。' : 'Your first report will appear here. Import two comparable periods of data to get started.')}</p>}
    {analysis?.action && <div className="overview-next-step"><span>{zh ? '建议先做' : 'Suggested next step'}</span><p>{analysis.action}</p></div>}
  </section>;
}

const severityLabels: Record<string, [string, string]> = { critical: ['Critical', '紧急'], warning: ['Warning', '注意'], opportunity: ['Opportunity', '机会'], info: ['Info', '提示'] };
const statusLabels: Record<string, [string, string]> = { suggested: ['Suggested', '待评估'], planned: ['Planned', '已计划'], in_progress: ['In progress', '进行中'] };

export function OverviewActions({ actions, zh }: { actions: OverviewAction[]; zh: boolean }) {
  if (!actions.length) return null;
  return <section className="overview-action-panel" aria-labelledby="overview-actions-heading">
    <header className="overview-section-heading">
      <div className="overview-section-title"><i><ListTodo size={20} aria-hidden="true" /></i><div><h2 id="overview-actions-heading">{zh ? '优先处理' : 'Needs attention'}</h2><p>{zh ? '待处理任务，按优先级排列' : 'Open tasks, ordered by priority'}</p></div></div>
      <Link href="/dashboard/actions">{zh ? '查看全部任务' : 'View all tasks'}<ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
    <ol className="overview-action-list">{actions.map((action, index) => <li key={action.id}>
      <span className="overview-action-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="overview-action-content">
        <div className="overview-action-meta"><span className="overview-severity" data-severity={action.severity}>{severityLabels[action.severity]?.[zh ? 1 : 0] || action.severity}</span><span className="overview-action-status" data-status={action.status}>{statusLabels[action.status]?.[zh ? 1 : 0] || action.status.replaceAll('_', ' ')}</span>{action.occurrenceCount > 1 && <small>{zh ? `出现 ${action.occurrenceCount} 次` : `Seen ${action.occurrenceCount} times`}</small>}</div>
        <h3>{action.title}</h3>
        <p>{action.recommendedAction}</p>
      </div>
    </li>)}</ol>
  </section>;
}
