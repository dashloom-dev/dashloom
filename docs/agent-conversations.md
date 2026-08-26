# Agent conversations

Dashloom keeps related Agent questions in a workspace-isolated thread so you can ask follow-ups without losing the business context. Start from **Agent**, choose one of the five specialists, choose either the whole portfolio or one real product, enter a decision question, and continue in the conversation created for that answer.

The Agent catalog calculates readiness separately for every specialist from evidence inside the same 14-day interactive comparison window. A revenue model is enabled only by revenue, commercial custom metrics, or matching competitor metrics; SEO and operations use their own contracts. The page shows matching point counts and the latest matching date before a model call, and the API repeats the check so stale UI or direct requests cannot create an unsupported analysis. Model comparisons use the same readiness policy.

## How continuity works

- A conversation is locked to its original specialist.
- A conversation is also locked to its original product scope. A direct request cannot widen a product thread to the whole workspace or switch it to another product.
- Product-scoped readiness, first-party metrics, linked competitor evidence, goals, health, and Growth Missions are filtered on the server before the evidence bundle is created.
- If the selected product is later removed, the thread becomes unavailable for new analysis instead of silently widening to the workspace.
- Each turn rebuilds the current metric, competitor, freshness, product-health, competitor-period trend, and cross-signal evidence.
- At most four previous successful turns are reduced to bounded question, summary, and recommended-action snippets.
- Historical raw metrics and citation identifiers are not copied into the new prompt context.
- Historical text is treated as untrusted data and cannot change system instructions.
- Every material claim in the new answer must cite an identifier in the newly frozen evidence bundle.
- Cross-signal evidence records co-movement, not causation. Any explanation built from it must be labeled as a hypothesis and retain the relationship evidence identifier.
- Competitor trends use the same period rollup rules as first-party metrics, but their collection methods may differ and must be disclosed in an interpretation.
- Interactive analysis compares seven days with the preceding seven days. Scheduled daily, weekly, and monthly reports use matching 1-, 7-, and 30-day comparison windows.

Open **Inspect frozen evidence** on any answer to review the exact input and validated citations. Archive a finished thread from the conversation list; archiving hides it from the active list without deleting its auditable runs.

## Choose the right scope

Use **All products** for portfolio allocation, cross-product ranking, and an executive operating brief. Choose one product for debugging a regression, reviewing a revenue target, investigating an SEO opportunity, or preparing a product/client update. Signal Radar investigations select and lock the signal's product automatically.

## Good follow-up questions

- “Which of these risks changed since the previous answer?”
- “Turn the highest-confidence opportunity into a three-step experiment.”
- “Compare the revenue movement with the SEO change, but keep currencies separate.”

Do not use an Agent answer as accounting, legal, or incident-response authorization. Verify consequential actions against the linked source evidence.
