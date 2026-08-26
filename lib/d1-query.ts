export type D1MetricConfiguration = { sql: string; dateColumn: string; metrics: Record<string, string> };

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
  return { ...configuration, sql: query };
}
