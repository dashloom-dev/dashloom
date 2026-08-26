# Agent Skill manifests

Agent Skills adapt one of Dashloom's five evidence-bound analysts to a domain workflow. A skill adds analysis guidance and declares required metrics; it does not receive credentials, execute code, call external tools, or override the platform's evidence rules.

## Install a skill

Use **Marketplace** to install a bundled, maintainer-reviewed Skill by its server-resolved slug. For a custom manifest, open **Settings → Extensibility** and provide:

- a stable lowercase slug and semantic version;
- one base analyst preset;
- the metrics the workflow expects;
- concise analysis guidance for that domain.

Owners and admins can install or update skills. Each analysis run snapshots the installed skill ID, slug, version, and required metrics into its evidence bundle. Disabled skills are not loaded.

Install-time validation rejects duplicate metric declarations, embedded URLs, instructions that try to override platform rules, credential requests, hidden-prompt requests, and external tool or command execution. The runner repeats this policy check so unsafe manifests created by an older release are excluded and recorded as rejected evidence metadata. Updating an installed slug requires a higher semantic version; submitting the exact same manifest remains idempotent. Every accepted instruction body receives a SHA-256 fingerprint, and analysis evidence freezes the instruction text, fingerprint, policy version, and required metrics used for that run.

Example:

```json
{
  "slug": "saas-unit-economics",
  "name": "SaaS Unit Economics",
  "version": "1.0.0",
  "basePreset": "revenue_analyst",
  "requiredMetrics": ["mrr", "churn_rate", "paid_users"],
  "instructions": "Prioritize sustainable MRR growth and flag churn changes above two percentage points."
}
```

Skill guidance is subordinate to Dashloom's system rules: analyze only supplied evidence, distinguish facts from hypotheses, never invent causes or units, and cite evidence IDs for material claims. Product names, domains, connector labels, and imported text remain untrusted data.

Run `npm test` before publishing a Skill manifest. The contract suite includes valid domain guidance plus adversarial instruction-override, secret-access, external-execution, URL, duplicate-metric, hashing, and version-order cases. Passing these local checks does not mean a third-party marketplace has reviewed or endorsed the Skill.
