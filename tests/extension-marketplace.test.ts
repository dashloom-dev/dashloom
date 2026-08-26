import assert from 'node:assert/strict';
import test from 'node:test';
import { marketplaceConnectors, marketplaceSkills, findMarketplaceSkill, getMarketplaceInstallState } from '../lib/extension-marketplace.ts';
import { AGENT_SKILL_POLICY_VERSION, agentSkillManifestSchema, validateAgentSkillPolicy } from '../lib/agent-skill-validation.ts';

test('marketplace distributes one reviewed skill for every built-in Agent specialist', () => {
  assert.equal(marketplaceSkills.length, 5);
  assert.equal(new Set(marketplaceSkills.map((skill) => skill.slug)).size, marketplaceSkills.length);
  assert.deepEqual(new Set(marketplaceSkills.map((skill) => skill.manifest.basePreset)), new Set(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']));
  for (const skill of marketplaceSkills) {
    assert.equal(skill.slug, skill.manifest.slug);
    assert.equal(skill.review.status, 'maintainer_reviewed');
    assert.equal(skill.review.policyVersion, AGENT_SKILL_POLICY_VERSION);
    assert.equal(agentSkillManifestSchema.safeParse(skill.manifest).success, true);
    assert.deepEqual(validateAgentSkillPolicy(skill.manifest), []);
    assert.match(skill.sourceUrl, /^https:\/\/github\.com\/dashloom-dev\/dashloom\/blob\//);
  }
});

test('marketplace lookup fails closed for unknown slugs', () => {
  assert.equal(findMarketplaceSkill('not-published'), null);
  assert.equal(findMarketplaceSkill('saas-unit-economics')?.manifest.version, '1.0.0');
});

test('connector catalog exposes only real built-in connection paths', () => {
  assert.ok(marketplaceConnectors.length >= 5);
  assert.equal(new Set(marketplaceConnectors.map((connector) => connector.slug)).size, marketplaceConnectors.length);
  for (const connector of marketplaceConnectors) {
    assert.equal(connector.status, 'built_in');
    assert.match(connector.href, /^\/dashboard\/(sources|settings)$/);
    assert.ok(connector.signals.length > 0);
  }
});

test('marketplace install state never mistakes a same-version custom manifest for reviewed code', () => {
  const manifest = marketplaceSkills[0].manifest;
  const exact = { version: manifest.version, name: manifest.name, basePreset: manifest.basePreset, instructions: manifest.instructions, requiredMetricsJson: JSON.stringify(manifest.requiredMetrics), enabled: true };
  assert.equal(getMarketplaceInstallState(manifest), 'available');
  assert.equal(getMarketplaceInstallState(manifest, exact), 'active');
  assert.equal(getMarketplaceInstallState(manifest, { ...exact, enabled: false }), 'disabled');
  assert.equal(getMarketplaceInstallState(manifest, { ...exact, version: '0.9.0' }), 'update');
  assert.equal(getMarketplaceInstallState(manifest, { ...exact, version: '2.0.0' }), 'newer');
  assert.equal(getMarketplaceInstallState(manifest, { ...exact, instructions: 'Different custom guidance with the same slug.' }), 'conflict');
});
