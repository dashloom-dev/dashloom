import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardConfigurationSchema, parseDashboardConfiguration, publicDashboardCopy } from '../lib/dashboard-templates.ts';

test('dashboard configuration accepts bounded normalized metrics', () => {
  const value = dashboardConfigurationSchema.parse({ title: 'Founder pulse', copy: 'Weekly decision signals', metrics: ['mrr', 'paid_customers', 'churn_rate'] });
  assert.deepEqual(value.metrics, ['mrr', 'paid_customers', 'churn_rate']);
});

test('shared Agent dashboards exclude internal narrative copy', () => {
  assert.equal(publicDashboardCopy('agent', 'Private Agent conclusion', 'Public template scope'), 'Public template scope');
  assert.equal(publicDashboardCopy('manual', 'Publisher-approved copy', 'Public template scope'), 'Publisher-approved copy');
});

test('dashboard configuration rejects unsafe names and falls back for historical invalid JSON', () => {
  assert.throws(() => dashboardConfigurationSchema.parse({ metrics: ['Revenue USD', '<script>'] }));
  assert.throws(() => dashboardConfigurationSchema.parse({ metrics: Array.from({ length: 9 }, (_, index) => `metric_${index}`) }));
  assert.deepEqual(parseDashboardConfiguration('{bad json'), {});
});
