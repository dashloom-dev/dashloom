import assert from 'node:assert/strict';
import test from 'node:test';
import { formatExecutiveReportSections, parseExecutiveSchedulePresets } from '../lib/executive-report.ts';

test('scheduled Executive Brief specialists are validated, deduplicated, and canonicalized', () => {
  assert.deepEqual(parseExecutiveSchedulePresets('["operations_analyst","revenue_analyst"]'), ['revenue_analyst', 'operations_analyst']);
  assert.throws(() => parseExecutiveSchedulePresets('["revenue_analyst","revenue_analyst"]'), /invalid/);
  assert.throws(() => parseExecutiveSchedulePresets('["revenue_analyst","unknown_analyst"]'), /invalid/);
  assert.throws(() => parseExecutiveSchedulePresets('not-json'), /invalid/);
});

test('scheduled Executive Brief report sections hide internal run and evidence IDs', () => {
  const sections = formatExecutiveReportSections({
    specialists: [{ agent: 'Revenue Analyst', analysisRunId: 'run-revenue', summary: 'Revenue moved.', findingCount: 1 }, { agent: 'Operations Analyst', analysisRunId: 'run-operations', summary: 'Errors changed.', findingCount: 1 }],
    priorities: [{ title: 'Review conversion', detail: 'Revenue changed.', agent: 'Revenue Analyst', action: 'Inspect checkout.', confidence: 0.912, evidenceRefs: ['metric:revenue'], analysisRunId: 'run-revenue' }],
  });
  assert.match(sections.specialists, /Revenue Analyst/);
  assert.match(sections.specialists, /Operations Analyst/);
  assert.doesNotMatch(sections.specialists, /run-revenue|run-operations/);
  assert.doesNotMatch(sections.priorities, /metric:revenue|Analysis run:/);
  assert.match(sections.priorities, /91%/);
});
