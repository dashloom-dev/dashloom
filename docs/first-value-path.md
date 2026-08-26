# First value path

Dashloom's workspace overview turns activation into a visible, evidence-backed path. It does not use onboarding flags, seeded products, or demo metrics. Every completed milestone is derived from the current workspace database.

## New workspace guide

Before the first successful analysis, the overview shows only the three steps needed to reach an initial useful answer:

1. **Create a product.** Add the real product Dashloom should understand.
2. **Connect real data.** A saved connection is not enough; the step completes only after recent metric evidence exists. If a source is connected but has not written data, the guide asks the user to run the first sync.
3. **See the first analysis.** If evidence exists but no model is ready, the guide routes through model setup. Otherwise it opens the Agent to produce an evidence-linked analysis.

After the first successful analysis, the compact guide is replaced by the full operating-loop milestones below.

## Milestones

1. **Add a real product.** At least one active product exists.
2. **Map or import a source.** An enabled mapping belongs to a connected provider account, or recent authenticated ingestion has already created evidence.
3. **Collect recent evidence.** At least one metric point is dated within the last 14 days.
4. **Enable an AI model.** A connected BYOK provider exists, or the workspace has a managed allowance and the deployment has a managed model configured. Owners and administrators can complete BYOK setup directly from the Agent page; a provider that fails the `/models` validation remains unavailable instead of silently enabling analysis.
5. **Run the Agent.** At least one evidence-linked analysis completed successfully.
6. **Plan an Agent action.** A suggested finding was moved to planned, in progress, or done. Merely generating or dismissing a suggestion does not count.
7. **Schedule the loop.** At least one daily, weekly, or monthly report schedule is enabled.

The earliest incomplete milestone is the recommended next step. Later milestones may still show as complete when real evidence proves that the user finished them out of order.

## Why it is strict

The path measures an operating loop, not account setup activity. A saved credential is not data, an LLM response is not evidence, and a generated recommendation is not execution. Community deployments never mix fictional data into a real workspace.
