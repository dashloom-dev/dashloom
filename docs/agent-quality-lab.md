# Agent Quality Lab

Dashloom's Agent Quality Lab compares two to four connected OpenAI-compatible providers against one identical, frozen workspace evidence bundle. It is designed for choosing a provider or model without changing the facts, Agent role, installed Skill versions, prompt contract, or output limits between runs.

## Run a comparison

1. Connect at least two validated providers under **Settings → Bring your own model**. Owners and admins can disable a provider at any time; disabling permanently removes its stored encrypted credential while preserving historical result snapshots.
2. Synchronize real product evidence.
3. Open **Agent → Agent Quality Lab**.
4. Choose an analyst, select two to four providers, enter one decision question, and run the comparison.

Each selected provider receives the same bounded evidence and question. Providers run independently. A failure from one provider produces a partial comparison rather than deleting successful results from the others.

## What is versioned and retained

Every comparison stores:

- the frozen evidence bundle and exact comparison periods;
- Agent preset, question, prompt version, and frozen Agent Skill versions and instruction hashes;
- provider display-name, mode, and model snapshots, without exposing API keys;
- only schema-valid and citation-valid findings;
- input/output token counts, observed request latency, finding and severity counts, actionable-item count, average self-reported confidence, and cited evidence IDs.

Unvalidated provider text is not retained. BYOK and managed usage still enters the append-only usage ledger. Managed comparisons require enough remaining daily allowance for all selected managed providers.

## Interpreting results

Dashloom calculates cited-evidence agreement using Jaccard overlap between each pair of result evidence-ID sets. This answers “did the models focus on the same facts?” It does not prove that two similarly worded explanations are correct, and low overlap does not automatically mean a provider is worse.

The Quality Lab deliberately does not ask one LLM to grade another and does not publish a synthetic winner score. Review citation validity, evidence choices, action quality, latency, token use, and stability across repeated versioned runs before changing a production model.

## Permissions and privacy

Only workspace owners and admins can start a comparison because each run can incur multiple external model calls. Workspace members can inspect stored comparison results. The same bounded-evidence, prompt-injection, currency, truncation-disclosure, relationship-hypothesis, and citation rules used by the production Agent apply to every compared provider.
