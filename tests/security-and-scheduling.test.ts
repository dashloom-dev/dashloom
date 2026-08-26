import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReadOnlyQuery } from '../lib/d1-query.ts';
import { assertSafeHttpsUrl } from '../lib/safe-url.ts';
import { nextScheduleRun } from '../lib/schedule-time.ts';

test('D1 query validator accepts bounded aggregate reads', () => {
  const result = validateReadOnlyQuery({ sql: '  SELECT date(created_at) AS metric_date, count(*) AS signups FROM users GROUP BY metric_date  ', dateColumn: 'metric_date', metrics: { signups: 'signups' } });
  assert.match(result.sql, /^SELECT/);
});

test('D1 query validator rejects mutations, stacked statements, comments, and unsafe names', () => {
  for (const sql of ['DELETE FROM users', 'SELECT * FROM users; DROP TABLE users', 'SELECT * FROM users -- ignore', 'PRAGMA table_info(users)']) assert.throws(() => validateReadOnlyQuery({ sql, dateColumn: 'metric_date', metrics: { value: 'value' } }));
  assert.throws(() => validateReadOnlyQuery({ sql: 'SELECT date, value FROM metrics', dateColumn: 'date value', metrics: { value: 'value' } }));
  assert.throws(() => validateReadOnlyQuery({ sql: 'SELECT date, value FROM metrics', dateColumn: 'date', metrics: { value: 'bad-name' } }));
});

test('HTTPS URL validator blocks credentials and non-public literal destinations', () => {
  assert.equal(assertSafeHttpsUrl('https://example.com/hook').hostname, 'example.com');
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://localhost/hook', 'https://127.0.0.1', 'https://10.1.2.3', 'https://100.64.1.2', 'https://169.254.169.254', 'https://192.168.1.1', 'https://198.51.100.7', 'https://203.0.113.4', 'https://[::1]/']) assert.throws(() => assertSafeHttpsUrl(url));
});

test('schedule calculation honors timezone, weekday, and short months', () => {
  assert.equal(nextScheduleRun({ cadence: 'weekly', timezone: 'Asia/Shanghai', hourLocal: 8, dayOfWeek: 1 }, new Date('2026-08-25T10:00:00.000Z')), '2026-08-31T00:00:00.000Z');
  assert.equal(nextScheduleRun({ cadence: 'monthly', timezone: 'UTC', hourLocal: 8, dayOfMonth: 31 }, new Date('2026-02-01T00:00:00.000Z')), '2026-02-28T08:00:00.000Z');
  assert.equal(nextScheduleRun({ cadence: 'daily', timezone: 'UTC', hourLocal: 8 }, new Date('2026-08-25T10:00:00.000Z')), '2026-08-26T08:00:00.000Z');
});
