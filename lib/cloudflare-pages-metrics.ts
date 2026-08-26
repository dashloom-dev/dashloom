export type CloudflarePagesDeployment = {
  created_on?: string | null;
  environment?: string | null;
  is_skipped?: boolean | null;
  latest_stage?: { status?: string | null; ended_on?: string | null } | null;
};

function timestamp(value: string | null | undefined) { const parsed = value ? Date.parse(value) : Number.NaN; return Number.isFinite(parsed) ? parsed : null; }

export function cloudflarePagesDeploymentMetrics(deployments: CloudflarePagesDeployment[], now = new Date()) {
  const daily = new Map<string, { deployments: number; successful: number; failed: number; canceled: number; production: number; skipped: number; durationTotal: number; durationCount: number }>();
  const valid = deployments.flatMap((deployment) => { const created = timestamp(deployment.created_on); return created === null ? [] : [{ deployment, created }]; }).sort((a, b) => b.created - a.created);
  for (const { deployment, created } of valid) {
    const date = new Date(created).toISOString().slice(0, 10); const value = daily.get(date) || { deployments: 0, successful: 0, failed: 0, canceled: 0, production: 0, skipped: 0, durationTotal: 0, durationCount: 0 }; const status = String(deployment.latest_stage?.status || '').toLowerCase();
    value.deployments += 1; if (deployment.is_skipped) value.skipped += 1; else if (status === 'success') value.successful += 1; else if (status === 'failure') value.failed += 1; else if (status === 'canceled') value.canceled += 1; if (deployment.environment === 'production') value.production += 1;
    const ended = timestamp(deployment.latest_stage?.ended_on); if (!deployment.is_skipped && ended !== null && ended >= created) { value.durationTotal += ended - created; value.durationCount += 1; } daily.set(date, value);
  }
  const completed = valid.find(({ deployment }) => !deployment.is_skipped && ['success', 'failure', 'canceled'].includes(String(deployment.latest_stage?.status || '').toLowerCase())); const latest = valid.find(({ deployment }) => !deployment.is_skipped); const completedStatus = String(completed?.deployment.latest_stage?.status || '').toLowerCase();
  return { daily, stocks: { pages_last_completed_deployment_success: completed ? (completedStatus === 'success' ? 1 : 0) : null, pages_days_since_deployment: latest ? Math.max(0, Math.floor((now.getTime() - latest.created) / 86400000)) : null } };
}
