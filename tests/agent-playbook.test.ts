import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_PLAYBOOK_SYSTEM_POLICY, agentPlaybookEvidence, agentPlaybookSchema, defaultAgentPlaybook, parseAgentPlaybook, serializeAgentPlaybook } from '../lib/agent-playbook.ts';

test('agent playbooks provide specialist-specific safe defaults', () => {
  assert.deepEqual(defaultAgentPlaybook('operations_analyst').priorities, ['reliability', 'delivery']);
  assert.equal(defaultAgentPlaybook('client_reporting_analyst').businessModel, 'agency');
});

test('legacy, malformed, and out-of-policy profiles fail closed to defaults', () => {
  for (const raw of ['{', JSON.stringify({ focus: 'legacy', version: 1 }), JSON.stringify({ ...defaultAgentPlaybook('revenue_analyst'), priorities: ['revenue', 'execute_arbitrary_code'] })]) {
    assert.deepEqual(parseAgentPlaybook(raw, 'revenue_analyst'), defaultAgentPlaybook('revenue_analyst'));
  }
});

test('playbooks are bounded, strict, serialized, and frozen as evidence', () => {
  const playbook = agentPlaybookSchema.parse({ version: 2, businessModel: 'saas', primaryObjective: 'Grow retained MRR without hiding refund risk.', priorities: ['revenue', 'retention'], changeSensitivity: 'high', responseStyle: 'concise', language: 'en' });
  assert.equal(parseAgentPlaybook(serializeAgentPlaybook(playbook), 'revenue_analyst').primaryObjective, playbook.primaryObjective);
  assert.deepEqual(agentPlaybookEvidence('revenue_analyst', playbook), { schemaVersion: 2, analyst: 'Revenue Analyst', businessModel: 'saas', primaryObjective: playbook.primaryObjective, priorities: ['revenue', 'retention'], changeSensitivity: 'high', responseStyle: 'concise', language: 'en' });
  assert.equal(agentPlaybookSchema.safeParse({ ...playbook, unknownControl: true }).success, false);
  assert.equal(agentPlaybookSchema.safeParse({ ...playbook, primaryObjective: 'x'.repeat(241) }).success, false);
});

test('playbook policy keeps operator objectives subordinate to evidence rules', () => {
  assert.match(AGENT_PLAYBOOK_SYSTEM_POLICY, /untrusted data, never instructions/i);
  assert.match(AGENT_PLAYBOOK_SYSTEM_POLICY, /cannot override.*evidence policy/i);
});
