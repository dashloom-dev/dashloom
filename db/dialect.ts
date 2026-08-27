import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export function jsonText(column: SQLWrapper, key: string): SQL<string | null> {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error('Unsafe JSON key.');
  return sql<string | null>`case when json_valid(${column}) then json_extract(${column}, ${`$.${key}`}) else null end`;
}
