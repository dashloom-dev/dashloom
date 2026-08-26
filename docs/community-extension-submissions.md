# Community Agent Skill submissions

Dashloom accepts public Agent Skill submissions through a provenance-first workflow. The process is designed to make the source, license, permissions, review identity, and exact reviewed commit verifiable. It does not treat repository metadata as a security guarantee.

## Submission states

1. **Proposed** — an issue describes the user decision, required evidence, data access, and permission boundary.
2. **Submitted** — a pull request adds a valid `extensions/community/<slug>/submission.json` tied to a public repository and immutable source commit.
3. **Independently reviewed** — an eligible reviewer inspects that exact source commit, adds `review.json`, and approves the current pull-request head on GitHub.
4. **Published** — maintainers explicitly bundle the immutable manifest in the Marketplace catalog after policy, provenance, tests, and product-fit checks.

These states are not interchangeable. Merge, review, and Marketplace publication are separate decisions.

## Publisher workflow

1. Open a **Community extension proposal** issue.
2. Fork the repository and create `extensions/community/<slug>/submission.json` from `extensions/community/submission.example.json`.
3. Pin `source.commit` to the exact 40-character commit SHA that contains the reviewed Skill source. Do not use a branch or tag as provenance.
4. Document the public source repository, license, required metrics, instructions, and permission boundary. Do not include credentials, personal settings, customer data, or secrets.
5. Run `npm run validate:extensions`, `npm test`, and the normal project checks.
6. Open a pull request. The publisher must not create their own `review.json` or claim independent review.

The current automated community contract accepts bounded Agent Skill manifests. Connector proposals are welcome through the issue template, but connector code remains maintainer-integrated until a separately sandboxed connector contract is available.

## Independent reviewer workflow

The reviewer must be a different GitHub identity from both the publisher and pull-request author. Review the exact `source.commit`, including:

- publisher and repository identity;
- license and right to distribute;
- requested data, metrics, and permission boundary;
- instructions against the Agent Skill policy;
- absence of credential requests, arbitrary execution, tools, URL fetching, and instruction overrides;
- contract tests and claimed behavior.

After completing the review, add `extensions/community/<slug>/review.json` from the example, reference the current pull-request number and exact source commit, then submit an **Approve** review against the current PR head. If any commit is added afterward, approval must be renewed.

## Automated verification

Local and CI validation checks the submission schema, slug/directory match, source provenance, manifest policy, review schema, exact source commit, and independent identities. On pull requests, CI additionally queries GitHub reviews and requires the attested reviewer to have approved the current head commit.

Repository administrators should require the CI workflow and pull-request reviews in the `main` branch protection rules. A direct push that bypasses branch protection cannot provide the same independent-review guarantee.

## Trust boundary

An independent review is evidence that a named person completed the published checklist for an exact commit. It is not a security certification, warranty, or endorsement. Dashloom Skills remain declarative: they cannot execute code, access credentials, call tools, fetch URLs, expand Agent permissions, override platform instructions, or bypass evidence citations.
