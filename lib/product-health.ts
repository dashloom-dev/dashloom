export type HealthMetric = { metric: string; current: number; previous: number; source?: string };

export type HealthPoint = { productId: string; source: string; metric: string; metricDate: string; value: number };

export function calculateProductHealth(input: { productId: string; metrics: HealthMetric[]; freshness: string | null; now?: Date }) {
  const now = input.now || new Date();
  const reasons: string[] = [];
  if (!input.metrics.length) return { evidenceId: `health:${input.productId}`, score: 0, status: 'no_data' as const, reasons: ['No metric evidence is available.'] };
  let score = 100;
  const freshnessDays = input.freshness ? Math.max(0, Math.floor((now.getTime() - new Date(`${input.freshness}T00:00:00Z`).getTime()) / 86400000)) : 999;
  if (freshnessDays > 7) { score -= 40; reasons.push('Evidence is more than seven days old.'); }
  else if (freshnessDays > 3) { score -= 20; reasons.push('Evidence is more than three days old.'); }

  const current = new Map(input.metrics.map((item) => [item.metric, item.current]));
  const requests = current.get('requests') || 0; const errors = current.get('errors') || 0;
  const storedErrorRate = current.get('error_rate'); const errorRate = storedErrorRate === undefined ? (requests ? errors / requests : 0) : storedErrorRate > 1 ? storedErrorRate / 100 : storedErrorRate;
  if (errorRate > 0.05) { score -= 30; reasons.push(`Error rate is ${(errorRate * 100).toFixed(1)}%.`); }
  else if (errorRate > 0.01) { score -= 15; reasons.push(`Error rate is ${(errorRate * 100).toFixed(1)}%.`); }
  const r2Requests = current.get('r2_requests') || 0; const r2Errors = current.get('r2_errors') || 0; const r2ErrorRate = r2Requests ? r2Errors / r2Requests : 0;
  if (r2ErrorRate > 0.05) { score -= 20; reasons.push(`R2 error rate is ${(r2ErrorRate * 100).toFixed(1)}%.`); }
  else if (r2ErrorRate > 0.01) { score -= 10; reasons.push(`R2 error rate is ${(r2ErrorRate * 100).toFixed(1)}%.`); }
  for (const provider of ['vercel', 'pages']) { const failures = current.get(`${provider}_failed_deployments`) || 0; if (failures >= 3) { score -= 20; reasons.push(`${provider === 'pages' ? 'Cloudflare Pages' : 'Vercel'} recorded ${failures} failed deployments in the current period.`); } else if (failures > 0) { score -= 10; reasons.push(`${provider === 'pages' ? 'Cloudflare Pages' : 'Vercel'} recorded ${failures} failed deployment${failures === 1 ? '' : 's'} in the current period.`); } const latest = current.get(`${provider}_last_completed_deployment_success`); if (latest === 0) { score -= 15; reasons.push(`The latest completed ${provider === 'pages' ? 'Cloudflare Pages' : 'Vercel'} deployment did not succeed.`); } }
  if (current.get('supabase_project_healthy') === 0) { score -= 20; reasons.push('Supabase did not report the project as healthy.'); }
  const queueBacklog = current.get('queue_backlog_messages') || 0; const queueAge = current.get('queue_oldest_message_age_seconds') || 0; if (current.get('queue_delivery_paused') === 1) { score -= 25; reasons.push('Cloudflare Queue delivery is paused.'); } if (queueAge >= 3600 || queueBacklog >= 10000) { score -= 20; reasons.push(`Cloudflare Queue pressure is elevated (${queueBacklog} messages; oldest ${Math.round(queueAge / 60)} minutes).`); } else if (queueAge >= 300 || queueBacklog >= 1000) { score -= 10; reasons.push(`Cloudflare Queue backlog needs attention (${queueBacklog} messages).`); }

  for (const item of input.metrics.filter((metric) => ['revenue', 'mrr', 'active_users', 'clicks'].includes(metric.metric))) {
    if (!item.previous) continue;
    const change = ((item.current - item.previous) / Math.abs(item.previous)) * 100;
    if (change < -20) { score -= 12; reasons.push(`${item.metric} fell ${Math.abs(change).toFixed(1)}%.`); }
    else if (change < -10) { score -= 6; reasons.push(`${item.metric} fell ${Math.abs(change).toFixed(1)}%.`); }
  }
  const sourceCount = new Set(input.metrics.map((item) => item.source).filter(Boolean)).size;
  if (sourceCount < 2) { score -= 5; reasons.push('Only one data source contributes evidence.'); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { evidenceId: `health:${input.productId}`, score, status: score >= 80 ? 'healthy' as const : score >= 55 ? 'watch' as const : 'risk' as const, reasons: reasons.length ? reasons : ['Fresh evidence shows no material deterministic risk.'] };
}
