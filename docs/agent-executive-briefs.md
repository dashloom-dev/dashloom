# Executive Briefs

Executive Brief turns Dashloom's specialist Agents into one evidence-backed operating review. An owner or administrator selects two to five ready specialists, asks one decision question, and receives a ranked brief with direct links to every original analysis run.

## How it works

1. Open **Agent → Executive Brief**.
2. Choose all products or one real product, then select at least two specialists whose evidence is ready in that scope.
3. Ask a bounded operating question and run the brief.
4. Review the ranked priorities, then open any specialist result to inspect its frozen evidence and citations.

Portfolio, Revenue, SEO Growth, Operations, and Client Reporting use separate evidence policies. The server applies one immutable scope to every selected specialist; product briefs exclude other products' metrics, goals, competitors, missions, and actions. Each specialist freezes and validates its own evidence bundle and model response. Dashloom does not ask another model to merge those answers: it deterministically sorts validated findings and preserves the originating analysis-run link.

## AI capacity and failure behavior

- BYOK workspaces can coordinate up to five specialists in one brief.
- Community execution requires a connected BYOK provider and runs up to five selected specialists inside the deployment.
- Specialists run independently. If one provider call fails, successful results remain available and the brief is marked `partial`.
- Only owners and administrators can start a brief because one request can consume several model calls. Workspace members can inspect saved results.

## Schedule and deliver the operating review

Open **Reports → Schedule recurring intelligence**, choose **Executive Brief**, select a product scope and two to five ready specialists. The schedule supports daily, weekly, and monthly cadence, an IANA timezone, and a recurring decision question.

Each occurrence freezes cadence-matched evidence independently for every specialist. A stable schedule-and-occurrence idempotency key prevents a delivery retry from generating another brief or spending the model allowance again. The generated report links back to its Executive Brief, and the report body preserves every specialist run identifier and cited evidence reference.

## Data and audit boundaries

Questions, deterministic digests, stable failure codes, and specialist run identifiers remain isolated by workspace and carry an explicit portfolio or product scope. A deleted product never turns an historical product brief into a portfolio brief. Every priority links to the original frozen-evidence run. Executive Brief history follows the workspace analysis-retention policy and is included in a full owner/admin export; provider credentials are never exported.
