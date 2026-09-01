import type { GuidedMetricMapping } from './business-data-discovery';

export type D1MetricConfiguration = {
  sql: string;
  dateColumn: string;
  metrics: Record<string, string>;
  metricDimensions?: Record<string, Record<string, string | number | boolean>>;
};

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const forbiddenSql = /(?:;|--|\/\*|\*\/|\b(?:insert|update|delete|replace|drop|alter|create|truncate|attach|detach|pragma|vacuum|reindex)\b)/i;

export function validateReadOnlyQuery(configuration: D1MetricConfiguration) {
  const query = configuration.sql.trim();
  if (query.length < 10 || query.length > 8000) throw new Error('SQL must contain between 10 and 8,000 characters.');
  if (!/^(?:select|with)\b/i.test(query) || forbiddenSql.test(query)) throw new Error('Only one read-only SELECT or WITH query is allowed.');
  if (!identifier.test(configuration.dateColumn)) throw new Error('Date column must be a safe SQL result identifier.');
  const entries = Object.entries(configuration.metrics);
  if (!entries.length || entries.length > 20) throw new Error('Map between 1 and 20 metric columns.');
  for (const [column, metric] of entries) if (!identifier.test(column) || !identifier.test(metric)) throw new Error('Metric mappings may contain only letters, numbers, and underscores.');
  const metricDimensions = Object.fromEntries(Object.entries(configuration.metricDimensions || {}).flatMap(([metric, dimensions]) => {
    if (!identifier.test(metric) || !dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('Metric dimensions must use safe metric names and JSON objects.');
    const entries = Object.entries(dimensions);
    if (entries.length > 8 || entries.some(([key, value]) => !identifier.test(key) || !['string', 'number', 'boolean'].includes(typeof value))) throw new Error('Metric dimensions contain an unsupported key or value.');
    return [[metric, Object.fromEntries(entries)]];
  }));
  return { ...configuration, sql: query, ...(Object.keys(metricDimensions).length ? { metricDimensions } : {}) };
}

function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export function buildGuidedD1Configuration(mappings: GuidedMetricMapping[], currency = 'USD'): D1MetricConfiguration {
  if (!mappings.length) throw new Error('Select at least one detected business metric.');
  const pieces = mappings.map((mapping) => {
    const table = quoteIdentifier(mapping.resource);
    const value = quoteIdentifier(mapping.valueColumn);
    const metric = mapping.metric;
    const scale = mapping.scale === 0.01 ? ' * 0.01' : '';
    const statusFilter = mapping.filterColumn && mapping.filterValues?.length
      ? `lower(CAST(${quoteIdentifier(mapping.filterColumn)} AS TEXT)) IN (${mapping.filterValues.map((item) => `'${item.replaceAll("'", "''")}'`).join(', ')})`
      : '';
    if (metric === 'active_subscriptions') {
      const filter = statusFilter ? ` WHERE ${statusFilter}` : '';
      return `SELECT date('now') AS metric_date, '${metric}' AS metric_name, COUNT(DISTINCT ${value}) AS metric_value FROM ${table}${filter}`;
    }
    if (!mapping.dateColumn) throw new Error(`A date field is required for ${metric}.`);
    const date = quoteIdentifier(mapping.dateColumn);
    const aggregate = metric === 'revenue' ? `SUM(CAST(${value} AS REAL))${scale}` : `COUNT(DISTINCT ${value})`;
    return `SELECT date(${date}) AS metric_date, '${metric}' AS metric_name, ${aggregate} AS metric_value FROM ${table} WHERE ${date} >= datetime('now', '-90 days')${statusFilter ? ` AND ${statusFilter}` : ''} GROUP BY date(${date})`;
  });
  const metrics = Object.fromEntries(mappings.map((mapping) => [mapping.metric, mapping.metric]));
  const columns = mappings.map((mapping) => `SUM(CASE WHEN metric_name = '${mapping.metric}' THEN metric_value ELSE 0 END) AS ${quoteIdentifier(mapping.metric)}`).join(', ');
  return validateReadOnlyQuery({
    sql: `WITH metric_rows AS (${pieces.join(' UNION ALL ')}) SELECT metric_date, ${columns} FROM metric_rows WHERE metric_date IS NOT NULL GROUP BY metric_date ORDER BY metric_date`,
    dateColumn: 'metric_date',
    metrics,
    metricDimensions: mappings.some((mapping) => mapping.metric === 'revenue') ? { revenue: { currency: currency.toUpperCase() } } : undefined,
  });
}
