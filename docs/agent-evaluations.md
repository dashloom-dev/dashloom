# Agent quality evaluations

Dashloom ships an offline golden dataset for Portfolio, Revenue, SEO, Operations, and Agency Client analysis. It tests the output contract independently from any model vendor, so maintainers can compare prompt or provider changes against the same business cases.

Run the checked-in reference outputs:

```bash
npm run eval:agent
```

To evaluate captured outputs from another model, create a JSON object keyed by case ID and pass its path:

```bash
npm run eval:agent -- path/to/provider-outputs.json
```

Each output contains a `summary` and structured `findings`. Every finding supplies `title`, `detail`, `action`, `confidence`, and `evidenceRefs`. See `evals/reference-outputs.json` for the exact shape.

## What the evaluator checks

- every finding cites only evidence included in the case;
- required business signals are covered;
- scenario-specific concepts and action language appear;
- unsupported causal or outcome claims are absent;
- relationship evidence is cited as co-movement and never promoted to causal proof;
- confidence and finding counts stay within the contract;
- a single finding never combines monetary evidence from different currencies.

The command returns a non-zero exit code when any case fails. The included reference output verifies the harness, not a third-party model. A provider comparison is valid only when its actual captured outputs, model identifier, prompt version, date, and parameters are retained together.

For workspace-owned, live comparisons, see the [Agent Quality Lab](agent-quality-lab.md). It sends the same frozen evidence and output contract to two to four selected providers, then reports deterministic statistics without asking one model to grade another.
