export type ReportAction = {
  title: string;
  recommendedAction: string;
  severity: 'info' | 'opportunity' | 'warning' | 'critical';
  status: 'suggested' | 'planned' | 'in_progress' | 'done' | 'dismissed';
  occurrenceCount: number;
  dueAt: string | null;
};

export function formatAgentActionDigest(actions: ReportAction[], now = new Date()) {
  if (!actions.length) return '## Action progress\n\nNo open Agent actions.';
  const today = now.toISOString().slice(0, 10);
  const items = actions.map((action) => {
    const dueDate = action.dueAt?.slice(0, 10);
    const due = dueDate ? dueDate < today ? ` · overdue since ${dueDate}` : ` · due ${dueDate}` : '';
    return `- **[${action.severity.toUpperCase()}] ${action.title}** — ${action.status.replaceAll('_', ' ')} · seen ${action.occurrenceCount}×${due}\n  - ${action.recommendedAction}`;
  });
  return `## Action progress\n\n${items.join('\n')}`;
}
