# Extension Marketplace

The in-product Marketplace makes Dashloom's connector paths and Agent Skill packs discoverable without turning extensions into an untrusted execution channel.

## Catalog contents

The public repository currently distributes five Agent Skill packs, one for each built-in operating specialist:

- Portfolio Allocation Radar;
- SaaS Unit Economics;
- SEO Content Opportunity;
- Cloudflare Reliability Watch;
- Agency Executive Brief.

The connector catalog links to the current built-in Google, Bing, D1 business data, merchant revenue, Custom REST, ingestion API, and Connector SDK paths. Deployment platforms and application storage backends are intentionally not listed as business data sources. Connector credentials remain server-side and workspace scoped.

## Installation and trust

Only workspace Owners and Admins can install a catalog Skill. The browser sends only the published slug. The server resolves the immutable manifest from its bundled catalog, repeats schema and policy validation, enforces monotonic semantic versions, fingerprints the instructions, and records the publisher, source, review status, and version in the workspace audit log.

Each later analysis still freezes the exact Skill version and instruction fingerprint into its evidence bundle. Skills cannot read credentials, execute code, call tools, fetch URLs, override platform instructions, expand Agent permissions, or bypass evidence citations.

“Maintainer reviewed” means the manifest is published in the Dashloom repository and passes the current policy contract. It is not an independent security audit or third-party endorsement. The Marketplace links to the public source so operators can inspect the exact manifest before installation.

## Publishing

Use the [Agent Skill manifest guide](agent-skill-sdk.md) or [Connector SDK](connector-sdk.md), include contract tests, and document required metrics and permissions. Agent Skill publishers can follow the [community submission and review workflow](community-extension-submissions.md). Connector proposals currently begin with the public extension proposal issue template and remain maintainer-integrated.

Dashloom distinguishes four states: proposed, submitted, independently reviewed, and published. A submission is not automatically reviewed or available in the Marketplace. An independent review requires a repository attestation plus a matching GitHub approval on the current pull-request head from someone other than the publisher and pull-request author. Publication remains an explicit maintainer decision.
