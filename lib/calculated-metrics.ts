import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { calculatedMetricDefinitions, metricPoints } from '@/db/schema';
import { addRollupValue, finishRollup, type RollupAccumulator } from './metric-rollup';
import { applyCalculatedFormula } from './calculated-formula';
export { calculatedMetricInput } from './calculated-formula';

function currency(dimensionsJson: string) { try { const value = JSON.parse(dimensionsJson) as { currency?: unknown }; return typeof value.currency === 'string' && /^[a-z]{3}$/i.test(value.currency) ? value.currency.toLowerCase() : null; } catch { return null; } }
const empty = (): RollupAccumulator => ({ sum: 0, count: 0, latestDate: '', latestValue: 0 });

export async function recalculateWorkspaceMetrics(workspaceId: string, days = 30) {
  const db = getDb(); const definitions = await db.select().from(calculatedMetricDefinitions).where(and(eq(calculatedMetricDefinitions.workspaceId, workspaceId), eq(calculatedMetricDefinitions.enabled, true)));
  if (!definitions.length) return { definitions: 0, written: 0 };
  const start = new Date(Date.now() - Math.max(1, Math.min(days, 90) - 1) * 86400000).toISOString().slice(0, 10);
  const points = await db.select().from(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), gte(metricPoints.metricDate, start))).orderBy(metricPoints.metricDate).limit(10000);
  let written = 0;
  for (const definition of definitions) {
    // Rebuild the selected window so a removed source point or a newly-invalid
    // currency pairing cannot leave a stale calculated value behind.
    await db.delete(metricPoints).where(and(
      eq(metricPoints.workspaceId, workspaceId),
      eq(metricPoints.source, 'calculated'),
      eq(metricPoints.metric, definition.metric),
      gte(metricPoints.metricDate, start),
    ));
    const relevant = points.filter((point) => point.source !== 'calculated' && ((point.source === definition.leftSource && point.metric === definition.leftMetric) || (definition.rightSource && point.source === definition.rightSource && point.metric === definition.rightMetric)));
    const aggregates = new Map<string, { source: string; metric: string; productId: string; metricDate: string; currency: string | null; rollup: RollupAccumulator }>();
    for (const point of relevant) { const pointCurrency = currency(point.dimensionsJson); const key = `${point.source}:${point.metric}:${point.productId}:${point.metricDate}:${pointCurrency || ''}`; const value = aggregates.get(key) || { source: point.source, metric: point.metric, productId: point.productId, metricDate: point.metricDate, currency: pointCurrency, rollup: empty() }; addRollupValue(value.rollup, point.metricDate, point.value); aggregates.set(key, value); }
    const rows = [...aggregates.values()].map((value) => ({ ...value, value: finishRollup(value.metric, value.rollup) })); const leftRows = rows.filter((row) => row.source === definition.leftSource && row.metric === definition.leftMetric); const output = [];
    for (const left of leftRows) { let right: number | { value: number; currency: string | null }; if (definition.constantValue !== null) right = definition.constantValue; else { const candidates = rows.filter((row) => row.source === definition.rightSource && row.metric === definition.rightMetric && row.productId === left.productId && row.metricDate === left.metricDate && (row.currency === left.currency || row.currency === null || left.currency === null)); if (candidates.length !== 1) continue; right = { value: candidates[0].value, currency: candidates[0].currency }; } const result = applyCalculatedFormula({ value: left.value, currency: left.currency }, right, definition.operator, definition.scale); if (!result) continue; output.push({ workspaceId, productId: left.productId, source: 'calculated', metric: definition.metric, metricDate: left.metricDate, value: result.value, dimensionsJson: JSON.stringify({ ...(result.currency ? { currency: result.currency } : {}), definitionId: definition.id }), collectedAt: new Date().toISOString() }); }
    for (let index = 0; index < output.length; index += 10) await db.insert(metricPoints).values(output.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } }); written += output.length;
  }
  return { definitions: definitions.length, written };
}

export async function refreshCalculatedMetricsSafely(workspaceId: string) {
  try { return await recalculateWorkspaceMetrics(workspaceId); }
  catch (error) { return { error: error instanceof Error ? error.message.slice(0, 500) : 'Calculated metric refresh failed' }; }
}
