import assert from 'node:assert/strict';
import test from 'node:test';
import { assessGrowthMission, GROWTH_MISSION_LIMITATION, growthMissionProgressPercent } from '../lib/agent-growth-mission-policy.ts';

test('growth mission progress supports increase and decrease targets', () => {
  assert.equal(growthMissionProgressPercent(100, 120, 110), 50);
  assert.equal(growthMissionProgressPercent(10, 5, 7.5), 50);
  assert.equal(growthMissionProgressPercent(100, 120, 125), 125);
  assert.equal(growthMissionProgressPercent(1, 1, 1), null);
});

test('growth missions reach targets early and close missed targets at the deadline', () => {
  const before = new Date('2026-08-20T00:00:00.000Z');
  const after = new Date('2026-09-02T00:00:00.000Z');
  assert.deepEqual(assessGrowthMission({ baseline: 100, target: 120, latest: 110, dueAt: '2026-09-01T23:59:59.000Z', now: before }), { assessment: 'on_track', terminal: false });
  assert.deepEqual(assessGrowthMission({ baseline: 100, target: 120, latest: 121, dueAt: '2026-09-01T23:59:59.000Z', now: before }), { assessment: 'achieved', terminal: true });
  assert.deepEqual(assessGrowthMission({ baseline: 100, target: 120, latest: 110, dueAt: '2026-09-01T23:59:59.000Z', now: after }), { assessment: 'missed', terminal: true });
  assert.deepEqual(assessGrowthMission({ baseline: 100, target: 120, latest: null, dueAt: '2026-09-01T23:59:59.000Z', now: after }), { assessment: 'insufficient', terminal: true });
  assert.match(GROWTH_MISSION_LIMITATION, /does not prove/);
});
