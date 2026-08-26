import { addRollupValue, finishRollup, metricRollup, type RollupAccumulator } from './metric-rollup.ts';

export type ActionOutcomeMetricRow = { source: string; metricDate: string; value: number; dimensionsJson: string };
export type ActionOutcomeMetricIdentity = { source: string; metric: string; currency?: string | null };
export type ActionOutcomeMeasurement = { value: number; metricDate: string };

export function actionBaselineCutoff(metric: string, completedAt: string) {
  const completedDate = completedAt.slice(0, 10);
  if (metricRollup(metric) === 'latest') return completedDate;
  const value = new Date(`${completedDate}T00:00:00.000Z`);
  return new Date(value.getTime() - 86_400_000).toISOString().slice(0, 10);
}

function parseDimensions(value: string) {
  try { const parsed = JSON.parse(value) as Record<string, unknown>; return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}

function sourceMatches(row: { source: string; dimensionsJson: string }, source: string) {
  if (!source.startsWith('custom:')) return row.source === source;
  const connectorPrefix = source.slice('custom:'.length);
  const connector = parseDimensions(row.dimensionsJson).connector;
  return row.source === 'custom' && typeof connector === 'string' && connector.startsWith(connectorPrefix);
}

function currencyMatches(dimensionsJson: string, currency: string | null | undefined) {
  const value = parseDimensions(dimensionsJson).currency;
  const normalized = typeof value === 'string' && /^[a-z]{3}$/i.test(value) ? value.toLowerCase() : null;
  return normalized === (currency || null);
}

export function selectLatestActionMeasurement(rows: ActionOutcomeMetricRow[], identity: ActionOutcomeMetricIdentity): ActionOutcomeMeasurement | null {
  const matching = rows.filter((row) => sourceMatches(row, identity.source) && currencyMatches(row.dimensionsJson, identity.currency));
  const metricDate = matching.map((row) => row.metricDate).sort().at(-1);
  if (!metricDate) return null;
  const accumulator: RollupAccumulator = { sum: 0, count: 0, latestDate: '', latestValue: 0 };
  matching.filter((row) => row.metricDate === metricDate).sort((left, right) => left.dimensionsJson.localeCompare(right.dimensionsJson)).forEach((row) => addRollupValue(accumulator, row.metricDate, row.value));
  return { metricDate, value: finishRollup(identity.metric, accumulator) };
}
